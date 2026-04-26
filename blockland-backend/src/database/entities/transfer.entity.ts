import {
  Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Check,
} from 'typeorm';
import { BaseEntity }       from './base.entity';
import { Property }         from './property.entity';
import { User }             from './user.entity';
import { TransferApproval } from './transfer-approval.entity';
import { OwnershipRecord }  from './ownership-record.entity';
import { TransferStatus }   from '../enums';

@Entity('transfers')
@Index('IDX_transfers_property_id', ['propertyId'])
@Index('IDX_transfers_seller_id',   ['sellerId'])
@Index('IDX_transfers_buyer_id',    ['buyerId'])
@Index('IDX_transfers_status',      ['status'])
@Check('CHK_transfers_sale_value', `sale_value IS NULL OR sale_value > 0`)
export class Transfer extends BaseEntity {
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @Column({ name: 'status', type: 'enum', enum: TransferStatus, default: TransferStatus.PENDING_BUYER })
  status: TransferStatus;

  @Column({ name: 'initiated_at', type: 'timestamptz', default: () => 'NOW()' })
  initiatedAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'sale_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  saleValue: number | null;

  @Column({ name: 'blockchain_tx_hash', type: 'varchar', length: 100, nullable: true })
  blockchainTxHash: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  // ── Marketplace-flow fields ──────────────────────────────────────────────
  @Column({ name: 'marketplace_listing_id', type: 'uuid', nullable: true })
  marketplaceListingId: string | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'min_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  minPrice: number | null;

  @Column({ name: 'max_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxPrice: number | null;

  @Column({ name: 'rejection_note', type: 'varchar', length: 500, nullable: true })
  rejectionNote: string | null;

  @Column({ name: 'cancellation_note', type: 'varchar', length: 500, nullable: true })
  cancellationNote: string | null;

  @Column({ name: 'pop_file_name', type: 'varchar', length: 255, nullable: true })
  popFileName: string | null;

  @Column({ name: 'pop_file_path', type: 'varchar', length: 500, nullable: true })
  popFilePath: string | null;

  @Column({ name: 'pop_uploaded_at', type: 'timestamptz', nullable: true })
  popUploadedAt: Date | null;

  @Column({ name: 'seller_confirmed_at', type: 'timestamptz', nullable: true })
  sellerConfirmedAt: Date | null;

  // ── Relations ────────────────────────────────────────────────────────────
  @ManyToOne(() => Property, (prop) => prop.transfers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, (user) => user.salesAssSeller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ManyToOne(() => User, (user) => user.purchasesAsBuyer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @OneToMany(() => TransferApproval, (appr) => appr.transfer, { cascade: ['insert'] })
  approvals: TransferApproval[];

  @OneToMany(() => OwnershipRecord, (rec) => rec.transfer)
  ownershipRecords: OwnershipRecord[];
}
