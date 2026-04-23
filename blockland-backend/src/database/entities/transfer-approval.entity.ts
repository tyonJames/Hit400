import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity }                  from './base.entity';
import { Transfer }                    from './transfer.entity';
import { User }                        from './user.entity';
import { ApproverRole, ApprovalAction } from '../enums';

@Entity('transfer_approvals')
@Index('IDX_transfer_approvals_transfer_id', ['transferId'])
@Index('IDX_transfer_approvals_approved_by', ['approvedById'])
export class TransferApproval extends BaseEntity {
  @Column({ name: 'transfer_id', type: 'uuid' })
  transferId: string;

  @Column({ name: 'approved_by', type: 'uuid' })
  approvedById: string;

  @Column({ name: 'approver_role', type: 'enum', enum: ApproverRole })
  approverRole: ApproverRole;

  @Column({ name: 'approved_at', type: 'timestamptz', default: () => 'NOW()' })
  approvedAt: Date;

  @Column({ name: 'action', type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @ManyToOne(() => Transfer, (tr) => tr.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer;

  @ManyToOne(() => User, (user) => user.transferApprovals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;
}
