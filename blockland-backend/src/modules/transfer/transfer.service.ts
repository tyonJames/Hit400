import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import { Transfer }         from '../../database/entities/transfer.entity';
import { Property }         from '../../database/entities/property.entity';
import { User }             from '../../database/entities/user.entity';
import { TransferApproval } from '../../database/entities/transfer-approval.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  TransferStatus, PropertyStatus, ApproverRole, ApprovalAction, AcquisitionType, UserRole,
} from '../../database/enums';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)         private transferRepo: Repository<Transfer>,
    @InjectRepository(Property)         private propertyRepo: Repository<Property>,
    @InjectRepository(User)             private userRepo: Repository<User>,
    @InjectRepository(TransferApproval) private approvalRepo: Repository<TransferApproval>,
    @InjectRepository(OwnershipRecord)  private ownershipRepo: Repository<OwnershipRecord>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async initiate(dto: CreateTransferDto, user: JwtPayload) {
    const property = await this.propertyRepo.findOne({ where: { id: dto.propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    if (property.currentOwnerId !== user.sub) throw new ForbiddenException('Only the owner can initiate a transfer.');
    if (property.status !== PropertyStatus.ACTIVE) throw new ConflictException(`Property status is ${property.status}.`);
    if (dto.buyerId === user.sub) throw new ConflictException('Cannot transfer to yourself.');

    const buyer = await this.userRepo.findOne({ where: { id: dto.buyerId, isActive: true } });
    if (!buyer) throw new NotFoundException('Buyer not found.');

    const registrarKey  = this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY', '');
    const buyerAddress  = buyer.walletAddress ?? buyer.id;

    const transfer = await this.dataSource.transaction(async (em) => {
      property.status = PropertyStatus.PENDING_TRANSFER;
      await em.save(property);

      return em.save(em.create(Transfer, {
        propertyId:  dto.propertyId,
        sellerId:    user.sub,
        buyerId:     dto.buyerId,
        saleValue:   dto.saleValue ?? null,
        notes:       dto.notes    ?? null,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_INITIATED',
      entityType: 'Transfer', entityId: transfer.id,
    });
    return transfer;
  }

  async findAll(params: { page?: number; limit?: number; status?: TransferStatus }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const where: any = {};
    if (params.status) where.status = params.status;
    const [data, total] = await this.transferRepo.findAndCount({
      where,
      order:     { initiatedAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['property', 'seller', 'buyer'],
    });
    return { data, total, page, limit };
  }

  async findMine(userId: string, params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.transferRepo.findAndCount({
      where: [{ sellerId: userId }, { buyerId: userId }],
      order: { initiatedAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
      relations: ['property', 'seller', 'buyer'],
    });
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const transfer = await this.transferRepo.findOne({
      where:     { id },
      relations: ['property', 'seller', 'buyer', 'approvals', 'approvals.approvedBy'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    return transfer;
  }

  async buyerApprove(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    if (transfer.buyerId !== user.sub) throw new ForbiddenException('Only the buyer can approve.');
    if (transfer.status !== TransferStatus.PENDING_BUYER) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }

    await this.dataSource.transaction(async (em) => {
      transfer.status = TransferStatus.PENDING_REGISTRAR;
      await em.save(transfer);
      await em.save(em.create(TransferApproval, {
        transferId:   id,
        approvedById: user.sub,
        approverRole: ApproverRole.BUYER,
        action:       ApprovalAction.APPROVED,
        notes:        notes ?? null,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_BUYER_APPROVED',
      entityType: 'Transfer', entityId: id,
    });
    return this.findOne(id);
  }

  async registrarApprove(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }

    const registrarKey = this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY', '');
    const txid = await this.blockchainService.finalizeTransfer({
      propertyId: parseInt(transfer.property.tokenId, 10),
      senderKey:  registrarKey,
    });

    await this.dataSource.transaction(async (em) => {
      transfer.status           = TransferStatus.CONFIRMED;
      transfer.confirmedAt      = new Date();
      transfer.blockchainTxHash = txid;
      await em.save(transfer);

      await em.save(em.create(TransferApproval, {
        transferId:   id,
        approvedById: user.sub,
        approverRole: ApproverRole.REGISTRAR,
        action:       ApprovalAction.APPROVED,
        notes:        notes ?? null,
      }));

      // Update current owner
      transfer.property.currentOwnerId = transfer.buyerId;
      transfer.property.status         = PropertyStatus.ACTIVE;
      await em.save(transfer.property);

      // Close old ownership record
      await em.update(OwnershipRecord,
        { propertyId: transfer.propertyId, releasedAt: null },
        { releasedAt: new Date() },
      );

      // Create new ownership record
      await em.save(em.create(OwnershipRecord, {
        propertyId:       transfer.propertyId,
        ownerId:          transfer.buyerId,
        transferId:       id,
        acquiredAt:       new Date(),
        acquisitionType:  AcquisitionType.TRANSFER,
        blockchainTxHash: txid,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_CONFIRMED',
      entityType: 'Transfer', entityId: id,
      metadata: { txid },
    });
    return { transfer: await this.findOne(id), blockchainTxHash: txid };
  }

  async cancel(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    const canCancel = transfer.sellerId === user.sub
      || user.roles.includes(UserRole.REGISTRAR)
      || user.roles.includes(UserRole.ADMIN);
    if (!canCancel) throw new ForbiddenException('Insufficient permissions to cancel.');
    if ([TransferStatus.CONFIRMED, TransferStatus.CANCELLED].includes(transfer.status)) {
      throw new ConflictException('Transfer cannot be cancelled at this stage.');
    }

    await this.dataSource.transaction(async (em) => {
      transfer.status      = TransferStatus.CANCELLED;
      transfer.cancelledAt = new Date();
      transfer.notes       = notes ?? transfer.notes;
      await em.save(transfer);

      transfer.property.status = PropertyStatus.ACTIVE;
      await em.save(transfer.property);
    });

    return this.findOne(id);
  }
}
