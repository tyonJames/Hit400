import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, Or } from 'typeorm';
import * as fs    from 'fs';
import * as path  from 'path';
import PDFDocument from 'pdfkit';
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

const TRANSFER_EXPIRY_DAYS  = 10;
const EXPIRY_WARN_DAYS      = 3;

const ACTIVE_STATUSES = [
  TransferStatus.PENDING_REGISTRAR,
  TransferStatus.AWAITING_PAYMENT,
  TransferStatus.PENDING_SELLER_CONFIRMATION,
  TransferStatus.PENDING_REGISTRAR_FINAL,
];

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(Transfer)           private transferRepo: Repository<Transfer>,
    @InjectRepository(Property)           private propertyRepo: Repository<Property>,
    @InjectRepository(User)               private userRepo: Repository<User>,
    @InjectRepository(TransferApproval)   private approvalRepo: Repository<TransferApproval>,
    @InjectRepository(OwnershipRecord)    private ownershipRepo: Repository<OwnershipRecord>,
    @InjectRepository(MarketplaceListing) private listingRepo: Repository<MarketplaceListing>,
    private blockchainService: BlockchainService,
    private activityLogService: ActivityLogService,
    private messagesService:    MessagesService,
    private configService:      ConfigService,
    private dataSource:         DataSource,
  ) {}

  // ── Public ledger ─────────────────────────────────────────────────────────

  async findPublic(params: { page?: number; limit?: number; search?: string }) {
    const page  = Math.max(1, Number(params.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));

    const qb = this.transferRepo.createQueryBuilder('t')
      .leftJoin('t.property', 'prop')
      .leftJoin('t.seller',   'seller')
      .leftJoin('t.buyer',    'buyer')
      .select([
        't.id', 't.blockchainTxHash', 't.certificateNumber',
        't.confirmedAt', 't.initiatedAt',
        'prop.plotNumber', 'prop.address', 'prop.titleDeedNumber',
        'seller.fullName',
        'buyer.fullName',
      ])
      .where('t.status = :status', { status: TransferStatus.CONFIRMED });

    if (params.search) {
      qb.andWhere(
        '(prop.plot_number ILIKE :q OR prop.address ILIKE :q OR seller.full_name ILIKE :q OR buyer.full_name ILIKE :q)',
        { q: `%${params.search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('t.confirmed_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map(t => ({
        id:                 t.id,
        plotNumber:         (t as any).property?.plotNumber        ?? '—',
        titleDeedNumber:    (t as any).property?.titleDeedNumber   ?? '—',
        address:            (t as any).property?.address           ?? '—',
        sellerName:         (t as any).seller?.fullName            ?? '—',
        buyerName:          (t as any).buyer?.fullName             ?? '—',
        confirmedAt:        t.confirmedAt,
        certificateNumber:  t.certificateNumber,
        blockchainTxHash:   t.blockchainTxHash,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Initiate (unified — used by direct path and marketplace selectBuyer) ──

  async initiate(dto: CreateTransferDto, user: JwtPayload) {
    const property = await this.propertyRepo.findOne({ where: { id: dto.propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    if (property.currentOwnerId !== user.sub)
      throw new ForbiddenException('Only the property owner can initiate a transfer.');
    if (property.status !== PropertyStatus.ACTIVE)
      throw new ConflictException(`Property status is ${property.status}.`);
    if (dto.buyerId === user.sub)
      throw new ConflictException('Cannot transfer to yourself.');

    const buyer = await this.userRepo.findOne({ where: { id: dto.buyerId, isActive: true } });
    if (!buyer) throw new NotFoundException('Buyer not found.');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRANSFER_EXPIRY_DAYS);

    const transfer = await this.dataSource.transaction(async (em) => {
      property.status = PropertyStatus.PENDING_TRANSFER;
      await em.save(property);
      return em.save(em.create(Transfer, {
        propertyId:          dto.propertyId,
        sellerId:            user.sub,
        buyerId:             dto.buyerId,
        saleValue:           dto.saleValue           ?? null,
        paymentMethod:       dto.paymentMethod        ?? null,
        paymentInstructions: dto.paymentInstructions  ?? null,
        notes:               dto.notes               ?? null,
        marketplaceListingId: dto.marketplaceListingId ?? null,
        minPrice:            dto.minPrice             ?? null,
        maxPrice:            dto.maxPrice             ?? null,
        status:              TransferStatus.PENDING_REGISTRAR,
        expiresAt,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_INITIATED',
      entityType: 'Transfer', entityId: transfer.id,
    });

    const full = await this.findOne(transfer.id);
    const plot = full.property?.plotNumber ?? 'property';

    // Notify registrars
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: staffIds,
        transferId:   full.id,
        subject:      `New transfer pending review — ${plot}`,
        body:         `A new property transfer has been submitted for your review.\n\n` +
                      `Property: ${plot}${full.property?.address ? ` (${full.property.address})` : ''}\n` +
                      `Seller: ${full.seller?.fullName ?? '—'}\n` +
                      `Buyer: ${full.buyer?.fullName ?? '—'}\n` +
                      `Sale value: ${full.saleValue ? `$${full.saleValue}` : 'Not specified'}\n` +
                      `Payment method: ${full.paymentMethod ?? 'Not specified'}\n\n` +
                      `Please log in to review and approve the transfer.`,
      })
    ).catch(() => {});

    return full;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findAll(params: { page?: number; limit?: number; status?: TransferStatus }) {
    const page  = Math.max(1, Number(params.page)  || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
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
    const page  = Math.max(1, Number(params.page)  || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
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

  // ── Step 1: Registrar reviews legitimacy ─────────────────────────────────

  async registrarReview(id: string, action: 'APPROVE' | 'REJECT', note: string, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR)
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    if (action === 'REJECT' && !note?.trim())
      throw new BadRequestException('A rejection note is required.');

    if (action === 'APPROVE') {
      transfer.status = TransferStatus.AWAITING_PAYMENT;
      await this.transferRepo.save(transfer);
      await this.activityLogService.log({
        userId: user.sub, action: 'TRANSFER_REGISTRAR_APPROVED',
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
        subject:      `Transfer approved — please make payment — ${plot}`,
        body:         `Hi ${updated.buyer?.fullName ?? 'there'},\n\n` +
                      `The registrar has reviewed and approved the transfer of ${plot}. ` +
                      `Please make your payment via ${method} and upload your proof of payment.` +
                      instrBlock +
                      `\n\nLog in to My Transfers to upload your proof of payment.`,
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
        userId: user.sub, action: 'TRANSFER_REGISTRAR_REJECTED',
        entityType: 'Transfer', entityId: id, metadata: { note },
      });

      const updated = await this.findOne(id);
      const plot    = updated.property?.plotNumber ?? 'property';
      this.messagesService.notify({
        senderId:     user.sub,
        recipientIds: [updated.buyerId, updated.sellerId],
        transferId:   id,
        subject:      `Transfer rejected — ${plot}`,
        body:         `The registrar has rejected the transfer of ${plot}.\n\nReason: ${note}\n\n` +
                      `The property has been restored to active status.`,
      }).catch(() => {});
    }

    return this.findOne(id);
  }

  // ── Step 2: Buyer uploads proof of payment ────────────────────────────────

  async buyerUploadPop(id: string, file: Express.Multer.File, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.buyerId !== user.sub) throw new ForbiddenException('Only the buyer can upload POP.');
    if (transfer.status !== TransferStatus.AWAITING_PAYMENT)
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);

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
        body:         `${updated.buyer?.fullName ?? 'The buyer'} has uploaded proof of payment for ` +
                      `${plot}${updated.property?.address ? ` (${updated.property.address})` : ''}.\n\n` +
                      `Please log in to My Transfers to review the document and confirm payment received.`,
      })
    ).catch(() => {});

    return updated;
  }

  async servePop(id: string) {
    const transfer = await this.transferRepo.findOne({ where: { id } });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    if (!transfer.popFilePath || !fs.existsSync(transfer.popFilePath))
      throw new NotFoundException('POP file not found.');
    return { filePath: transfer.popFilePath, fileName: transfer.popFileName ?? 'proof-of-payment.pdf' };
  }

  // ── Step 3: Seller confirms or disputes payment ───────────────────────────

  async sellerConfirmPayment(id: string, confirmed: boolean, note: string, user: JwtPayload) {
    const transfer = await this.findOne(id);
    if (transfer.sellerId !== user.sub) throw new ForbiddenException('Only the seller can confirm payment.');
    if (transfer.status !== TransferStatus.PENDING_SELLER_CONFIRMATION)
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);

    if (confirmed) {
      transfer.status            = TransferStatus.PENDING_REGISTRAR_FINAL;
      transfer.sellerConfirmedAt = new Date();
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
                        `${plot}. Please log in to complete the transfer on the blockchain.`,
        })
      ).catch(() => {});

      return updated;
    } else {
      if (!note?.trim()) throw new BadRequestException('A dispute note is required.');
      transfer.status        = TransferStatus.AWAITING_PAYMENT;
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
        subject:      `Payment disputed — please re-upload — ${plot}`,
        body:         `Hi ${updated.buyer?.fullName ?? 'there'},\n\n` +
                      `${updated.seller?.fullName ?? 'The seller'} has disputed your proof of payment.\n\n` +
                      `Reason: ${note}\n\nPlease re-upload a valid proof of payment.`,
      }).catch(() => {});

      return updated;
    }
  }

  // ── Step 4: Registrar final sign-off + blockchain ─────────────────────────

  async registrarComplete(id: string, user: JwtPayload, notes?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.PENDING_REGISTRAR_FINAL)
      throw new ConflictException(`Transfer is in ${transfer.status} status.`);
    return this._finaliseOnChain(transfer, id, user, notes);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(id: string, user: JwtPayload, note?: string) {
    const transfer = await this.findOne(id);
    const isAdmin     = user.roles.includes(UserRole.ADMIN);
    const isRegistrar = user.roles.includes(UserRole.REGISTRAR);
    const isSeller    = transfer.sellerId === user.sub;
    const isBuyer     = transfer.buyerId  === user.sub;

    const terminal = [
      TransferStatus.CONFIRMED, TransferStatus.CANCELLED,
      TransferStatus.REJECTED,  TransferStatus.EXPIRED,
    ];
    if (terminal.includes(transfer.status))
      throw new ConflictException('Transfer cannot be cancelled at this stage.');
    if (transfer.status === TransferStatus.FROZEN)
      throw new ConflictException('Transfer is frozen due to an active dispute. Resolve the dispute first.');

    if (transfer.status === TransferStatus.PENDING_SELLER_CONFIRMATION) {
      if (!isSeller && !isAdmin && !isRegistrar)
        throw new ForbiddenException('Only the seller can cancel after POP is uploaded.');
    } else if (transfer.status === TransferStatus.PENDING_REGISTRAR_FINAL) {
      if (!isRegistrar && !isAdmin)
        throw new ForbiddenException('Only the registrar can cancel at this stage.');
    } else {
      if (!isSeller && !isBuyer && !isRegistrar && !isAdmin)
        throw new ForbiddenException('Insufficient permissions to cancel.');
    }

    if (!note?.trim()) throw new BadRequestException('A cancellation note is required.');

    await this.dataSource.transaction(async (em) => {
      transfer.status           = TransferStatus.CANCELLED;
      transfer.cancelledAt      = new Date();
      transfer.cancellationNote = note ?? null;
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
        body:         `The transfer of ${plot} has been cancelled.\n\nReason: ${note}`,
      })
    ).catch(() => {});

    return updated;
  }

  // ── Freeze / unfreeze (called by DisputeService) ──────────────────────────

  async freezeForDispute(propertyId: string, reason: string) {
    const transfer = await this.transferRepo.findOne({
      where: [
        { propertyId, status: TransferStatus.PENDING_REGISTRAR },
        { propertyId, status: TransferStatus.AWAITING_PAYMENT },
        { propertyId, status: TransferStatus.PENDING_SELLER_CONFIRMATION },
        { propertyId, status: TransferStatus.PENDING_REGISTRAR_FINAL },
      ],
      relations: ['property', 'seller', 'buyer'],
    });
    if (!transfer) return;

    transfer.preFreezeStatus = transfer.status;
    transfer.frozenAt        = new Date();
    transfer.frozenReason    = reason;
    transfer.status          = TransferStatus.FROZEN;
    await this.transferRepo.save(transfer);

    const plot = transfer.property?.plotNumber ?? 'property';
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     transfer.sellerId,
        recipientIds: [transfer.sellerId, transfer.buyerId, ...staffIds],
        transferId:   transfer.id,
        subject:      `Transfer frozen — dispute in progress — ${plot}`,
        body:         `The transfer of ${plot} has been frozen because a dispute has been raised on this property.\n\n` +
                      `Reason: ${reason}\n\nThe transfer will resume once the dispute is resolved.`,
      })
    ).catch(() => {});
  }

  async unfreezeAfterDispute(propertyId: string) {
    const transfer = await this.transferRepo.findOne({
      where: { propertyId, status: TransferStatus.FROZEN },
      relations: ['property', 'seller', 'buyer'],
    });
    if (!transfer) return;

    transfer.status   = (transfer.preFreezeStatus as TransferStatus) ?? TransferStatus.PENDING_REGISTRAR;
    transfer.frozenAt     = null;
    transfer.frozenReason = null;
    transfer.preFreezeStatus = null;
    await this.transferRepo.save(transfer);

    const plot = transfer.property?.plotNumber ?? 'property';
    this.messagesService.getStaffIds().then((staffIds) =>
      this.messagesService.notify({
        senderId:     transfer.sellerId,
        recipientIds: [transfer.sellerId, transfer.buyerId, ...staffIds],
        transferId:   transfer.id,
        subject:      `Transfer unfrozen — dispute resolved — ${plot}`,
        body:         `The dispute on ${plot} has been resolved. Your transfer has resumed and is back in its previous stage.`,
      })
    ).catch(() => {});
  }

  // ── Expiry (called by cron) ───────────────────────────────────────────────

  async processExpiry() {
    const now  = new Date();
    const warn = new Date(now.getTime() + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000);

    // Warn transfers expiring within 3 days
    const toWarn = await this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.property', 'p')
      .leftJoinAndSelect('t.seller', 's')
      .leftJoinAndSelect('t.buyer', 'b')
      .where('t.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('t.expires_at <= :warn', { warn })
      .andWhere('t.expiry_warning_sent_at IS NULL')
      .getMany();

    for (const t of toWarn) {
      const daysLeft = Math.ceil((t.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const plot     = t.property?.plotNumber ?? 'property';
      await this.messagesService.getStaffIds().then((staffIds) =>
        this.messagesService.notify({
          senderId:     t.sellerId,
          recipientIds: [t.sellerId, t.buyerId, ...staffIds],
          transferId:   t.id,
          subject:      `Transfer expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${plot}`,
          body:         `The transfer of ${plot} will automatically expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} ` +
                        `if no action is taken.\n\nPlease log in to continue the transfer process.`,
        })
      ).catch(() => {});
      t.expiryWarningSentAt = now;
      await this.transferRepo.save(t);
    }

    // Auto-expire overdue transfers
    const toExpire = await this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.property', 'p')
      .leftJoinAndSelect('t.seller', 's')
      .leftJoinAndSelect('t.buyer', 'b')
      .where('t.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('t.expires_at < :now', { now })
      .getMany();

    for (const t of toExpire) {
      await this.dataSource.transaction(async (em) => {
        t.status = TransferStatus.EXPIRED;
        await em.save(t);
        if (t.property) {
          t.property.status = PropertyStatus.ACTIVE;
          await em.save(t.property);
        }
        if (t.marketplaceListingId) {
          await em.update(MarketplaceListing,
            { id: t.marketplaceListingId },
            { status: ListingStatus.ACTIVE },
          );
        }
      });

      const plot = t.property?.plotNumber ?? 'property';
      await this.messagesService.getStaffIds().then((staffIds) =>
        this.messagesService.notify({
          senderId:     t.sellerId,
          recipientIds: [t.sellerId, t.buyerId, ...staffIds],
          transferId:   t.id,
          subject:      `Transfer expired — ${plot}`,
          body:         `The transfer of ${plot} has expired after ${TRANSFER_EXPIRY_DAYS} days of inactivity and has been automatically cancelled. ` +
                        `The property is now active again. You may initiate a new transfer if needed.`,
        })
      ).catch(() => {});
    }
  }

  // ── Certificate PDF ───────────────────────────────────────────────────────

  async generateCertificate(id: string): Promise<Buffer> {
    const transfer = await this.findOne(id);
    if (transfer.status !== TransferStatus.CONFIRMED)
      throw new ConflictException('Certificate is only available for confirmed transfers.');
    if (!transfer.certificateNumber)
      throw new ConflictException('Certificate number not set on this transfer.');

    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const plot    = transfer.property?.plotNumber ?? '—';
      const address = transfer.property?.address    ?? '—';
      const seller  = transfer.seller?.fullName     ?? '—';
      const buyer   = transfer.buyer?.fullName      ?? '—';
      const date    = transfer.confirmedAt
        ? new Date(transfer.confirmedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

      doc.fontSize(22).font('Helvetica-Bold').text('BLOCKLAND LAND REGISTRY', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(16).font('Helvetica').text('Certificate of Transfer', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(11).fillColor('#555').text(transfer.certificateNumber, { align: 'center' });
      doc.fillColor('#000').moveDown(1.5);

      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(1);

      const row = (label: string, value: string) => {
        doc.fontSize(10).font('Helvetica-Bold').text(label, { continued: true });
        doc.font('Helvetica').text(`  ${value}`);
        doc.moveDown(0.4);
      };

      row('Plot Number:',   plot);
      row('Address:',       address);
      row('Seller:',        seller);
      row('Buyer:',         buyer);
      row('Sale Value:',    transfer.saleValue ? `ZWL ${Number(transfer.saleValue).toFixed(2)}` : 'Not disclosed');
      row('Payment Method:', transfer.paymentMethod ?? '—');
      row('Date Confirmed:', date);
      row('Blockchain TX:', transfer.blockchainTxHash ?? '—');

      doc.moveDown(1);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(1);

      doc.fontSize(9).fillColor('#555')
        .text(
          'This certificate confirms the transfer of property ownership as recorded on the Blockland ' +
          'distributed ledger. It is generated automatically and does not require a physical signature.',
          { align: 'center' },
        );

      doc.end();
    });
  }

  // ── On-chain finalisation ─────────────────────────────────────────────────

  private async _finaliseOnChain(transfer: Transfer, id: string, user: JwtPayload, notes?: string) {
    const registrarKey = this.configService.get<string>('STACKS_REGISTRAR_PRIVATE_KEY')
      ?? this.configService.get<string>('STACKS_DEPLOYER_PRIVATE_KEY', '');
    const tokenId = parseInt(transfer.property?.tokenId ?? '0', 10);

    let txid: string;
    if (registrarKey && tokenId > 0) {
      try {
        txid = await this.blockchainService.finalizeTransfer({
          propertyId: tokenId,
          senderKey:  registrarKey,
        });
      } catch (err) {
        this.logger.warn(`Blockchain finalize failed (continuing off-chain): ${err?.message}`);
        txid = `sim-${Date.now()}-${id.slice(0, 8)}`;
      }
    } else {
      this.logger.warn('Blockchain not configured — using simulated txid for transfer finalization');
      txid = `sim-${Date.now()}-${id.slice(0, 8)}`;
    }

    const certNumber = `BL-CERT-${Date.now()}`;

    await this.dataSource.transaction(async (em) => {
      transfer.status            = TransferStatus.CONFIRMED;
      transfer.confirmedAt       = new Date();
      transfer.blockchainTxHash  = txid;
      transfer.certificateNumber = certNumber;
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
                    `has been completed.\n\n` +
                    `New owner: ${finalTransfer.buyer?.fullName ?? '—'}\n` +
                    `Certificate: ${certNumber}\n` +
                    `Blockchain TX: ${txid}\n\n` +
                    `You can download your transfer certificate from the transfer details page.`,
    }).catch(() => {});

    return { transfer: finalTransfer, blockchainTxHash: txid };
  }
}
