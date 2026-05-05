import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import { Dispute }          from '../../database/entities/dispute.entity';
import { Property }         from '../../database/entities/property.entity';
import { DisputeResolution } from '../../database/entities/dispute-resolution.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { TransferService }   from '../transfer/transfer.service';
import { DisputeStatus, PropertyStatus, UserRole } from '../../database/enums';
import { CreateDisputeDto }  from './dto/create-dispute.dto';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute)           private disputeRepo: Repository<Dispute>,
    @InjectRepository(Property)          private propertyRepo: Repository<Property>,
    @InjectRepository(DisputeResolution) private resolutionRepo: Repository<DisputeResolution>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private transferService:    TransferService,
    private configService:      ConfigService,
    private dataSource:         DataSource,
  ) {}

  async create(dto: CreateDisputeDto, user: JwtPayload) {
    const property = await this.propertyRepo.findOne({ where: { id: dto.propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    if (property.status === PropertyStatus.DISPUTED) {
      throw new ConflictException('Property already has an active dispute.');
    }

    const registrarKey =
      this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY') ??
      this.configService.get<string>('STACKS_DEPLOYER_PRIVATE_KEY', '');
    const tokenId = parseInt(property.tokenId ?? '0', 10) || 0;
    let txid: string;
    if (registrarKey && tokenId > 0) {
      try {
        txid = await this.blockchainService.flagDispute({ propertyId: tokenId, senderKey: registrarKey });
      } catch {
        txid = `sim-dispute-${Date.now()}-${dto.propertyId.slice(0, 8)}`;
      }
    } else {
      txid = `sim-dispute-${Date.now()}-${dto.propertyId.slice(0, 8)}`;
    }

    const dispute = await this.dataSource.transaction(async (em) => {
      property.status = PropertyStatus.DISPUTED;
      await em.save(property);

      const d = em.create(Dispute, {
        propertyId:       dto.propertyId,
        raisedById:       user.sub,
        disputeType:      dto.disputeType,
        description:      dto.description,
        blockchainTxHash: txid,
      });
      return em.save(d);
    });

    // Freeze any active transfer on this property
    await this.transferService.freezeForDispute(dto.propertyId, dto.description).catch(() => {});

    await this.activityLogService.log({
      userId: user.sub, action: 'DISPUTE_CREATED',
      entityType: 'Dispute', entityId: dispute.id,
      metadata: { propertyId: dto.propertyId, txid },
    });

    return { dispute, blockchainTxHash: txid };
  }

  async findAll(params: { page?: number; limit?: number; status?: DisputeStatus }, user: JwtPayload) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const where: any = {};
    if (params.status) where.status = params.status;
    const isPrivileged = user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.REGISTRAR);
    if (!isPrivileged) where.raisedById = user.sub;

    const [data, total] = await this.disputeRepo.findAndCount({
      where,
      order:     { raisedAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['property', 'raisedBy'],
    });
    return { data, total, page, limit };
  }

  async findMine(userId: string) {
    return this.disputeRepo.find({
      where:     { raisedById: userId },
      order:     { raisedAt: 'DESC' },
      relations: ['property'],
    });
  }

  async findOne(id: string) {
    const dispute = await this.disputeRepo.findOne({
      where:     { id },
      relations: ['property', 'raisedBy', 'evidence', 'resolution'],
    });
    if (!dispute) throw new NotFoundException('Dispute not found.');
    return dispute;
  }

  async resolve(id: string, resolutionNotes: string, user: JwtPayload) {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!dispute) throw new NotFoundException('Dispute not found.');
    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new ConflictException('Dispute already resolved.');
    }

    const registrarKey =
      this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY') ??
      this.configService.get<string>('STACKS_DEPLOYER_PRIVATE_KEY', '');
    const tokenId = parseInt(dispute.property.tokenId ?? '0', 10) || 0;
    let txid: string;
    if (registrarKey && tokenId > 0) {
      try {
        txid = await this.blockchainService.resolveDispute({ propertyId: tokenId, senderKey: registrarKey });
      } catch {
        txid = `sim-resolve-${Date.now()}-${id.slice(0, 8)}`;
      }
    } else {
      txid = `sim-resolve-${Date.now()}-${id.slice(0, 8)}`;
    }

    await this.dataSource.transaction(async (em) => {
      dispute.status          = DisputeStatus.RESOLVED;
      dispute.resolvedAt      = new Date();
      dispute.property.status = PropertyStatus.ACTIVE;
      await em.save(dispute);
      await em.save(dispute.property);

      await em.save(em.create(DisputeResolution, {
        disputeId:        id,
        resolvedById:     user.sub,
        resolutionNotes,
        blockchainTxHash: txid,
      }));
    });

    // Unfreeze any frozen transfer on this property
    await this.transferService.unfreezeAfterDispute(dispute.propertyId).catch(() => {});

    await this.activityLogService.log({
      userId: user.sub, action: 'DISPUTE_RESOLVED',
      entityType: 'Dispute', entityId: id,
      metadata: { txid },
    });

    return { dispute: await this.findOne(id), blockchainTxHash: txid };
  }
}
