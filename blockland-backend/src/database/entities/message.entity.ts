import {
  Entity, Column, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { BaseEntity }        from './base.entity';
import { User }              from './user.entity';
import { Transfer }          from './transfer.entity';
import { MessageRecipient }  from './message-recipient.entity';

@Entity('messages')
@Index('IDX_messages_sender_id',   ['senderId'])
@Index('IDX_messages_transfer_id', ['transferId'])
export class Message extends BaseEntity {
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
  transferId: string | null;

  @Column({ name: 'subject', type: 'varchar', length: 200 })
  subject: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'attachment_file_name', type: 'varchar', length: 255, nullable: true })
  attachmentFileName: string | null;

  @Column({ name: 'attachment_file_path', type: 'varchar', length: 500, nullable: true })
  attachmentFilePath: string | null;

  @Column({ name: 'attachment_file_size', type: 'integer', nullable: true })
  attachmentFileSize: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => Transfer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer | null;

  @OneToMany(() => MessageRecipient, (r) => r.message, { cascade: ['insert'] })
  recipients: MessageRecipient[];
}
