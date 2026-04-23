import {
  Entity, Column, ManyToOne, OneToMany, OneToOne, JoinColumn, Index, Check,
} from 'typeorm';
import { BaseEntity }        from './base.entity';
import { Property }          from './property.entity';
import { User }              from './user.entity';
import { DisputeEvidence }   from './dispute-evidence.entity';
import { DisputeResolution } from './dispute-resolution.entity';
import { DisputeType, DisputeStatus } from '../enums';

@Entity('disputes')
@Index('IDX_disputes_property_id', ['propertyId'])
@Index('IDX_disputes_status',      ['status'])
@Index('IDX_disputes_raised_by',   ['raisedById'])
@Check('CHK_disputes_description_length', `char_length(description) BETWEEN 20 AND 1000`)
export class Dispute extends BaseEntity {
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'raised_by', type: 'uuid' })
  raisedById: string;

  @Column({ name: 'dispute_type', type: 'enum', enum: DisputeType })
  disputeType: DisputeType;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'raised_at', type: 'timestamptz', default: () => 'NOW()' })
  raisedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'status', type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ name: 'blockchain_tx_hash', type: 'varchar', length: 100 })
  blockchainTxHash: string;

  @ManyToOne(() => Property, (prop) => prop.disputes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, (user) => user.raisedDisputes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'raised_by' })
  raisedBy: User;

  @OneToMany(() => DisputeEvidence, (ev) => ev.dispute, { cascade: ['insert'] })
  evidence: DisputeEvidence[];

  @OneToOne(() => DisputeResolution, (res) => res.dispute)
  resolution: DisputeResolution | null;
}
