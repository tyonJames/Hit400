import {
  Entity, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { BaseEntity }      from './base.entity';
import { Property }        from './property.entity';
import { User }            from './user.entity';
import { Transfer }        from './transfer.entity';
import { AcquisitionType } from '../enums';

@Entity('ownership_records')
@Index('IDX_ownership_property_id',   ['propertyId'])
@Index('IDX_ownership_owner_id',      ['ownerId'])
@Index('IDX_ownership_prop_released', ['propertyId', 'releasedAt'])
export class OwnershipRecord extends BaseEntity {
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
  transferId: string | null;

  @Column({ name: 'acquired_at', type: 'timestamptz' })
  acquiredAt: Date;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @Column({ name: 'acquisition_type', type: 'enum', enum: AcquisitionType })
  acquisitionType: AcquisitionType;

  @Column({ name: 'blockchain_tx_hash', type: 'varchar', length: 100 })
  blockchainTxHash: string;

  @ManyToOne(() => Property, (prop) => prop.ownershipRecords, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, (user) => user.ownershipRecords, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => Transfer, (tr) => tr.ownershipRecords, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer | null;
}
