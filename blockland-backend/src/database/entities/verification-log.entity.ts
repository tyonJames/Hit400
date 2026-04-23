import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { VerificationQueryType, VerificationResultStatus } from '../enums';

@Entity('verification_logs')
@Index('IDX_verification_queried_at',  ['queriedAt'])
@Index('IDX_verification_query_value', ['queryValue'])
@Index('IDX_verification_result',      ['resultStatus'])
export class VerificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'query_type', type: 'enum', enum: VerificationQueryType })
  queryType: VerificationQueryType;

  @Column({ name: 'query_value', type: 'varchar', length: 100 })
  queryValue: string;

  @Column({ name: 'result_status', type: 'enum', enum: VerificationResultStatus })
  resultStatus: VerificationResultStatus;

  @CreateDateColumn({ name: 'queried_at', type: 'timestamptz' })
  queriedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
}
