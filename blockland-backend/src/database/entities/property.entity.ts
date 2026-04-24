import {
  Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Check,
} from 'typeorm';
import { BaseEntity }       from './base.entity';
import { User }             from './user.entity';
import { OwnershipRecord }  from './ownership-record.entity';
import { Transfer }         from './transfer.entity';
import { Dispute }          from './dispute.entity';
import { PropertyDocument } from './property-document.entity';
import { PropertyStatus, LandSizeUnit, ZoningType } from '../enums';

@Entity('properties')
@Index('IDX_properties_plot_number',       ['plotNumber'],      { unique: true })
@Index('IDX_properties_title_deed_number', ['titleDeedNumber'], { unique: true })
@Index('IDX_properties_current_owner',     ['currentOwnerId'])
@Index('IDX_properties_status',            ['status'])
@Index('IDX_properties_token_id',          ['tokenId'],         { unique: true })
@Index('IDX_properties_blockchain_tx',     ['blockchainTxHash'])
@Check('CHK_properties_plot_length',    `char_length(plot_number) >= 3`)
@Check('CHK_properties_address_length', `char_length(address) >= 5`)
@Check('CHK_properties_land_size',      `land_size > 0`)
@Check('CHK_properties_title_deed_len', `char_length(title_deed_number) >= 5`)
@Check('CHK_properties_reg_date',       `registration_date <= CURRENT_DATE`)
export class Property extends BaseEntity {
  @Column({ name: 'plot_number', type: 'varchar', length: 20, unique: true })
  plotNumber: string;

  @Column({ name: 'title_deed_number', type: 'varchar', length: 30, unique: true })
  titleDeedNumber: string;

  @Column({ name: 'address', type: 'varchar', length: 150 })
  address: string;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLat: number | null;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLng: number | null;

  @Column({ name: 'land_size', type: 'decimal', precision: 12, scale: 4 })
  landSize: number;

  @Column({ name: 'unit', type: 'enum', enum: LandSizeUnit, default: LandSizeUnit.SQM })
  unit: LandSizeUnit;

  @Column({ name: 'zoning_type', type: 'enum', enum: ZoningType })
  zoningType: ZoningType;

  @Column({ name: 'registration_date', type: 'date' })
  registrationDate: string;

  @Column({ name: 'status', type: 'enum', enum: PropertyStatus, default: PropertyStatus.PENDING_APPROVAL })
  status: PropertyStatus;

  @Column({ name: 'token_id', type: 'varchar', length: 100, nullable: true })
  tokenId: string | null;

  @Column({ name: 'blockchain_tx_hash', type: 'varchar', length: 100, nullable: true })
  blockchainTxHash: string | null;

  @Column({ name: 'ipfs_hash', type: 'varchar', length: 100, nullable: true })
  ipfsHash: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'registration_comment', type: 'varchar', length: 500, nullable: true })
  registrationComment: string | null;

  @Column({ name: 'record_hash', type: 'char', length: 64, nullable: true })
  recordHash: string | null;

  @Column({ name: 'current_owner_id', type: 'uuid' })
  currentOwnerId: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.ownedProperties, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_owner_id' })
  currentOwner: User;

  @ManyToOne(() => User, (user) => user.registeredProperties, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => OwnershipRecord, (rec) => rec.property, { cascade: ['insert'] })
  ownershipRecords: OwnershipRecord[];

  @OneToMany(() => Transfer, (tr) => tr.property)
  transfers: Transfer[];

  @OneToMany(() => Dispute, (d) => d.property)
  disputes: Dispute[];

  @OneToMany(() => PropertyDocument, (doc) => doc.property, { cascade: ['insert'] })
  documents: PropertyDocument[];
}
