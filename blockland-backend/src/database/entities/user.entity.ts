import {
  Entity, Column, Index, OneToMany, Check,
} from 'typeorm';
import { BaseEntity }        from './base.entity';
import { UserRole as UserRoleEntity } from './user-role.entity';
import { AuthToken }         from './auth-token.entity';
import { Property }          from './property.entity';
import { OwnershipRecord }   from './ownership-record.entity';
import { Transfer }          from './transfer.entity';
import { TransferApproval }  from './transfer-approval.entity';
import { Dispute }           from './dispute.entity';
import { DisputeEvidence }   from './dispute-evidence.entity';
import { DisputeResolution } from './dispute-resolution.entity';
import { ActivityLog }       from './activity-log.entity';

@Entity('users')
@Index('IDX_users_email',       ['email'],      { unique: true })
@Index('IDX_users_national_id', ['nationalId'], { unique: true })
@Index('IDX_users_wallet',      ['walletAddress'])
@Check('CHK_users_full_name_length', `char_length(full_name) >= 3`)
@Check('CHK_users_email_format',     `email ~* '^[^@]+@[^@]+\\.[^@]+$'`)
@Check('CHK_users_phone_format',     `phone ~ '^[0-9]{10,15}$'`)
@Check('CHK_users_wallet_format',    `wallet_address IS NULL OR wallet_address ~ '^S[PT][A-Z0-9]{38,39}$'`)
export class User extends BaseEntity {
  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'national_id', type: 'varchar', length: 20, unique: true })
  nationalId: string;

  @Column({ name: 'email', type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ name: 'phone', type: 'varchar', length: 15 })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'wallet_address', type: 'varchar', length: 50, nullable: true })
  walletAddress: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved: boolean;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @OneToMany(() => UserRoleEntity, (ur) => ur.user, { cascade: true })
  userRoles: UserRoleEntity[];

  @OneToMany(() => AuthToken, (token) => token.user, { cascade: true })
  authTokens: AuthToken[];

  @OneToMany(() => Property, (prop) => prop.currentOwner)
  ownedProperties: Property[];

  @OneToMany(() => Property, (prop) => prop.createdBy)
  registeredProperties: Property[];

  @OneToMany(() => OwnershipRecord, (rec) => rec.owner)
  ownershipRecords: OwnershipRecord[];

  @OneToMany(() => Transfer, (tr) => tr.seller)
  salesAssSeller: Transfer[];

  @OneToMany(() => Transfer, (tr) => tr.buyer)
  purchasesAsBuyer: Transfer[];

  @OneToMany(() => TransferApproval, (appr) => appr.approvedBy)
  transferApprovals: TransferApproval[];

  @OneToMany(() => Dispute, (d) => d.raisedBy)
  raisedDisputes: Dispute[];

  @OneToMany(() => DisputeEvidence, (ev) => ev.uploadedBy)
  disputeEvidence: DisputeEvidence[];

  @OneToMany(() => DisputeResolution, (res) => res.resolvedBy)
  disputeResolutions: DisputeResolution[];

  @OneToMany(() => ActivityLog, (log) => log.user)
  activityLogs: ActivityLog[];
}
