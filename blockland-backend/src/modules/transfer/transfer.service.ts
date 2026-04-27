import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as fs   from 'fs';
import * as path from 'path';
import { ConfigService }    from '@nestjs/config';
import { Transfer }         from '../../database/entities/transfer.entity';
import { Property }         from '../../database/entities/property.entity';
import { User }             from '../../database/entities/user.entity';
import { TransferApproval } from '../../database/entities/transfer-approval.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { MarketplaceListing } from '../../database/entities/marketplace-listing.entity';
import { BlockchainService }  from '../blockchain/blockchain.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MessagesService }    from '../messages/messages.service';
import {
  TransferStatus, PropertyStatus, ApproverRole, ApprovalAction,
  AcquisitionType, UserRole, ListingStatus,
} from '../../database/enums';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

// Statuses where cancellation restores the listing
const MARKETPLACE_STATUSES = [
  TransferStatus.PENDING_REGISTRAR_TERMS,
  TransferStatus.AWAITING_POP,
  TransferStatus.PENDING_SELLER_CONFIRMATION,
  TransferStatus.PENDING_REGISTRAR_FINAL,
];

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)           private transferRepo: Repository<Transfer>,
    @InjectRepository(Property)           private propertyRepo: Repository<Property>,
    @InjectRepository(User)               private userRepo: Repository<User>,
    @InjectRepository(TransferApproval)   private approvalRepo: Repository<TransferApproval>,
    @InjectRepository(OwnershipRecord)    private ownershipRepo: Repository<OwnershipRecord>,
    @InjectRepository(MarketplaceListing) private listingRepo: Repository<MarketplaceListing>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private messagesService:   MessagesService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  // ── Direct transfer (existing flow) ──────────────────────────────────────

  async initiate(dto: CreateTransferDto, user: JwtPayload) {
    const property = await this.propertyRepo.findOne({ where: { id: dto.propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    if (property.currentOwnerId !== user.sub) throw new ForbiddenException('Only the owner can initiate a transfer.');
    if (property.status !== PropertyStatus.ACTIVE) throw new ConflictException(`Property status is ${property.status}.`);
    if (dto.buyerId === user.sub) throw new ConflictException('Cannot transfer to yourself.');

    const buyer = await this.userRepo.findOne({ where: { id: dto.buyerId, isActive: true } });
    if (!buyer) throw new NotFoundException('Buyer not found.');

    const transfer = await this.dataSource.transaction(async (em) => {
      property.status = PropertyStatus.PENDING_TRANSFER;
      await em.save(property);
      return em.save(em.create(Transfer, {
        propertyId: dto.propertyId,
        sellerId:   user.sub,
        buyerId:    dto.buyerId,
        saleValue:  dto.saleValue ?? null,
        notes:      dto.notes    ?? null,
        status:     TransferStatus.PENDING_BUYER,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_INITIATED',
      entityType: 'Transfer', entityId: transfer.id,
    });

    const full = await this.findOne(transfer.id);
    const plot = full.property?.plotNumber ?? 'property';
    this.messagesService.notify({
      senderId:    user.sub,
      recipientIds: [dto.buyerId],
      transferId:  full.id,
      subject:     `Transfer initiated — ${plot}`,
      body:        `Hi ${full.buyer?.fullName ?? 'there'},\n\n` +
                   `${full.seller?.fullName ?? 'The seller'} has initiated a property transfer to you for ` +
                   `${plot}${full.property?.address ? ` (${full.property.address})` : ''}.\n\n` +
                   `Please log in and go to My Transfers to review and approve.`,
    }).catch(() => {});

    return full;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

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

  // ── Direct-flow actions (unchanged) ──────────────────────────────────────

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
        transferId: id, approvedById: user.sub,
        approverRole: ApproverRole.BUYER, action: ApprovalAction.APPROVED, notes: notes ?? null,
      }));
    });
    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_BUYER_APPROVED',
      entityType: 'Transfer', entityId: id,
    });

    const updated = await this.findOne(id);
    const plot = updated.property?.plotNumber ?? 'property';
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: staffIds,
        transferId:   id,
        subject:      `Transfer ready for sign-off — ${plot}`,
        body:         `${updated.buyer?.fullName ?? 'The buyer'} has approved the transfer of ${plot}` +
                      `${updated.property?.address ? ` (${updated.property.address})` : ''}.\n\n` +
                      `Please log in to finalise the transfer on the blockchain.`,
      })
    ).catch(() => {});

    return updated;
  }

  async registrarApprove(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }
    return this._finaliseOnChain(transfer, id, user, notes);
  }

  // ── Marketplace-flow actions ──────────────────────────────────────────────

  async registrarReviewTerms(id: string, action: 'APPROVE' | 'REJECT', note: string, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR_TERMS) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }
    if (!note?.trim() && action === 'REJECT') {
      throw new BadRequestException('A rejection note is required.');
    }

    if (action === 'APPROVE') {
      transfer.status = TransferStatus.AWAITING_POP;
      await this.transferRepo.save(transfer);
      await this.activityLogService.log({
        userId: user.sub, action: 'TRANSFER_TERMS_APPROVED',
        entityType: 'Transfer', entityId: id,
      });

      const updated = await this.findOne(id);
      const plot    = updated.property?.plotNumber ?? 'property';
      const method  = updated.paymentMethod ?? 'the agreed method';
      const instrBlock = updated.paymentInstructions
        ? `\n\nPayment instructions from the seller:\n${updated.paymentInstructions}`
        : '';
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.buyerId],
        transferId:   id,
        subject:      `Terms approved — please make payment — ${plot}`,
        body:         `Hi ${updated.buyer?.fullName ?? 'there'},\n\n` +
                      `The registrar has approved the transfer terms for ${plot}. ` +
                      `Please make your payment via ${method} and then upload your proof of payment.` +
                      instrBlock +
                      `\n\nLog in to My Transfers to upload your payment proof.`,
      }).catch(() => {});
    } else {
      await this.dataSource.transaction(async (em) => {
        transfer.status        = TransferStatus.REJECTED;
        transfer.rejectionNote = note;
        transfer.cancelledAt   = new Date();
        await em.save(transfer);
        transfer.property.status = PropertyStatus.ACTIVE;
        await em.save(transfer.property);
        if (transfer.marketplaceListingId) {
          await em.update(MarketplaceListing,
            { id: transfer.marketplaceListingId },
            { status: ListingStatus.ACTIVE },
          );
        }
      });
      await this.activityLogService.log({
        userId: user.sub, action: 'TRANSFER_TERMS_REJECTED',
        entityType: 'Transfer', entityId: id, metadata: { note },
      });

      const updated = await this.findOne(id);
      const plot    = updated.property?.plotNumber ?? 'property';
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.buyerId, updated.sellerId],
        transferId:   id,
        subject:      `Transfer terms rejected — ${plot}`,
        body:         `The registrar has rejected the transfer terms for ${plot}.\n\n` +
                      `Reason: ${note}\n\n` +
                      `The listing has been restored to the marketplace. The seller may review and re-list.`,
      }).catch(() => {});
    }
    return this.findOne(id);
  }

  async buyerUploadPop(id: string, file: Express.Multer.File, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.buyerId !== user.sub) throw new ForbiddenException('Only the buyer can upload POP.');
    if (transfer.status !== TransferStatus.AWAITING_POP) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }

    // Persist file to disk
    const uploadDir = path.join(process.cwd(), 'uploads', 'pops');
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext      = (file.originalname.split('.').pop() ?? 'pdf').toLowerCase();
    const fileName = `pop-${id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    transfer.popFileName   = file.originalname;
    transfer.popFilePath   = filePath;
    transfer.popUploadedAt = new Date();
    transfer.status        = TransferStatus.PENDING_SELLER_CONFIRMATION;
    await this.transferRepo.save(transfer);

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_POP_UPLOADED',
      entityType: 'Transfer', entityId: id,
    });

    const updated = await this.findOne(id);
    const plot    = updated.property?.plotNumber ?? 'property';
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.sellerId, ...staffIds],
        transferId:   id,
        subject:      `Proof of payment uploaded — ${plot}`,
        body:         `${updated.buyer?.fullName ?? 'The buyer'} has uploaded proof of payment for the transfer of ` +
                      `${plot}${updated.property?.address ? ` (${updated.property.address})` : ''}.\n\n` +
                      `Please log in to My Transfers to review the document and confirm payment received.`,
      })
    ).catch(() => {});

    return updated;
  }

  async servePop(id: string) {
    const transfer = await this.transferRepo.findOne({ where: { id } });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    if (!transfer.popFilePath || !fs.existsSync(transfer.popFilePath)) {
      throw new NotFoundException('POP file not found.');
    }
    return { filePath: transfer.popFilePath, fileName: transfer.popFileName ?? 'proof-of-payment.pdf' };
  }

  async sellerConfirmPayment(id: string, confirmed: boolean, note: string, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.sellerId !== user.sub) throw new ForbiddenException('Only the seller can confirm payment.');
    if (transfer.status !== TransferStatus.PENDING_SELLER_CONFIRMATION) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }

    if (confirmed) {
      transfer.status             = TransferStatus.PENDING_REGISTRAR_FINAL;
      transfer.sellerConfirmedAt  = new Date();
      await this.transferRepo.save(transfer);
      await this.activityLogService.log({
        userId: user.sub, action: 'TRANSFER_PAYMENT_CONFIRMED',
        entityType: 'Transfer', entityId: id,
      });

      const updated = await this.findOne(id);
      const plot    = updated.property?.plotNumber ?? 'property';
      this.messagesService.getStaffIds().then((staffIds) =>
        this.messagesService.notify({
          senderId:     user.sub,
          recipientIds: staffIds,
          transferId:   id,
          subject:      `Payment confirmed — ready for final sign-off — ${plot}`,
          body:         `${updated.seller?.fullName ?? 'The seller'} has confirmed payment received for ` +
                        `${plot}${updated.property?.address ? ` (${updated.property.address})` : ''}.\n\n` +
                        `Please log in to complete the transfer and record ownership on the blockchain.`,
        })
      ).catch(() => {});

      return updated;
    } else {
      if (!note?.trim()) throw new BadRequestException('A dispute note is required.');
      transfer.status        = TransferStatus.AWAITING_POP;
      transfer.rejectionNote = note;
      await this.transferRepo.save(transfer);
      await this.activityLogService.log({
        userId: user.sub, action: 'TRANSFER_PAYMENT_DISPUTED',
        entityType: 'Transfer', entityId: id, metadata: { note },
      });

      const updated = await this.findOne(id);
      const plot    = updated.property?.plotNumber ?? 'property';
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.buyerId],
        transferId:   id,
        subject:      `Payment disputed — please re-upload proof — ${plot}`,
        body:         `Hi ${updated.buyer?.fullName ?? 'there'},\n\n` +
                      `${updated.seller?.fullName ?? 'The seller'} has disputed your proof of payment for ${plot}.\n\n` +
                      `Reason: ${note}\n\n` +
                      `Please review the issue, make the correct payment, and re-upload your proof of payment.`,
      }).catch(() => {});

      return updated;
    }
  }

  async registrarComplete(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR_FINAL) {
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    }
    return this._finaliseOnChain(transfer, id, user, notes);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(id: string, user: JwtPayload, note?: string) {
    const transfer = await this.findOne(id);
    const isAdmin      = user.roles.includes(UserRole.ADMIN);
    const isRegistrar  = user.roles.includes(UserRole.REGISTRAR);
    const isSeller     = transfer.sellerId === user.sub;
    const isBuyer      = transfer.buyerId  === user.sub;

    if ([TransferStatus.CONFIRMED, TransferStatus.CANCELLED, TransferStatus.REJECTED].includes(transfer.status)) {
      throw new ConflictException('Transfer cannot be cancelled at this stage.');
    }

    // Cancellation rules
    const { status } = transfer;
    if (status === TransferStatus.PENDING_SELLER_CONFIRMATION) {
      if (!isSeller && !isAdmin && !isRegistrar) {
        throw new ForbiddenException('Only the seller can cancel after POP is uploaded.');
      }
    } else if (status === TransferStatus.PENDING_REGISTRAR_FINAL) {
      if (!isRegistrar && !isAdmin) {
        throw new ForbiddenException('Only the registrar can cancel at this stage.');
      }
    } else {
      if (!isSeller && !isBuyer && !isRegistrar && !isAdmin) {
        throw new ForbiddenException('Insufficient permissions to cancel.');
      }
    }

    if (!note?.trim()) throw new BadRequestException('A cancellation note is required.');

    await this.dataSource.transaction(async (em) => {
      transfer.status           = TransferStatus.CANCELLED;
      transfer.cancelledAt      = new Date();
      transfer.cancellationNote = note ?? null;
      await em.save(transfer);

      transfer.property.status = PropertyStatus.ACTIVE;
      await em.save(transfer.property);

      // Restore listing if marketplace transfer
      if (transfer.marketplaceListingId) {
        await em.update(MarketplaceListing,
          { id: transfer.marketplaceListingId },
          { status: ListingStatus.ACTIVE },
        );
      }
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_CANCELLED',
      entityType: 'Transfer', entityId: id, metadata: { note },
    });

    const updated = await this.findOne(id);
    const plot    = updated.property?.plotNumber ?? 'property';
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.sellerId, updated.buyerId, ...staffIds],
        transferId:   id,
        subject:      `Transfer cancelled — ${plot}`,
        body:         `The transfer of ${plot}${updated.property?.address ? ` (${updated.property.address})` : ''} has been cancelled.\n\n` +
                      `Reason: ${note}`,
      })
    ).catch(() => {});

    return updated;
  }

  // ── Shared on-chain finalisation ──────────────────────────────────────────

  private async _finaliseOnChain(transfer: Transfer, id: string, user: JwtPayload, notes?: string) {
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

      transfer.property.currentOwnerId = transfer.buyerId;
      transfer.property.status         = PropertyStatus.ACTIVE;
      await em.save(transfer.property);

      await em.update(OwnershipRecord,
        { propertyId: transfer.propertyId, releasedAt: null },
        { releasedAt: new Date() },
      );

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
      entityType: 'Transfer', entityId: id, metadata: { txid },
    });

    const finalTransfer = await this.findOne(id);
    const plot = finalTransfer.property?.plotNumber ?? 'property';
    this.messagesService.notify({
      senderId:     user.sub,
      recipientIds: [finalTransfer.buyerId, finalTransfer.sellerId],
      transferId:   id,
      subject:      `Transfer complete — ownership confirmed — ${plot}`,
      body:         `The transfer of ${plot}${finalTransfer.property?.address ? ` (${finalTransfer.property.address})` : ''} ` +
                    `has been completed and ownership has been recorded on the blockchain.\n\n` +
                    `New owner: ${finalTransfer.buyer?.fullName ?? 'Buyer'}\n` +
                    `Blockchain TX: ${txid}`,
    }).catch(() => {});

    return { transfer: finalTransfer, blockchainTxHash: txid };
  }
}
