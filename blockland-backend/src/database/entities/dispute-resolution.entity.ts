import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Dispute } from './dispute.entity';
import { User }    from './user.entity';

@Entity('dispute_resolutions')
@Index('IDX_dispute_res_resolved_by', ['resolvedById'])
export class DisputeResolution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dispute_id', type: 'uuid', unique: true })
  disputeId: string;

  @Column({ name: 'resolved_by', type: 'uuid' })
  resolvedById: string;

  @Column({ name: 'resolution_notes', type: 'text' })
  resolutionNotes: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', default: () => 'NOW()' })
  resolvedAt: Date;

  @Column({ name: 'blockchain_tx_hash', type: 'varchar', length: 100 })
  blockchainTxHash: string;

  @OneToOne(() => Dispute, (d) => d.resolution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispute_id' })
  dispute: Dispute;

  @ManyToOne(() => User, (user) => user.disputeResolutions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resolved_by' })
  resolvedBy: User;
}
