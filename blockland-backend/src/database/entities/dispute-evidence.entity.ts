import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  CreateDateColumn,
} from 'typeorm';
import { Dispute } from './dispute.entity';
import { User }    from './user.entity';
import { FileType } from '../enums';

@Entity('dispute_evidence')
@Index('IDX_dispute_evidence_dispute_id',  ['disputeId'])
@Index('IDX_dispute_evidence_uploaded_by', ['uploadedById'])
@Check('CHK_dispute_evidence_file_size', `file_size_bytes > 0 AND file_size_bytes <= 5242880`)
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dispute_id', type: 'uuid' })
  disputeId: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedById: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_type', type: 'enum', enum: FileType })
  fileType: FileType;

  @Column({ name: 'file_size_bytes', type: 'integer' })
  fileSizeBytes: number;

  @Column({ name: 'ipfs_hash', type: 'varchar', length: 100 })
  ipfsHash: string;

  @Column({ name: 'file_hash', type: 'char', length: 64 })
  fileHash: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Dispute, (d) => d.evidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispute_id' })
  dispute: Dispute;

  @ManyToOne(() => User, (user) => user.disputeEvidence, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;
}
