import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Unique, Index,
} from 'typeorm';
import { Message } from './message.entity';
import { User }    from './user.entity';

@Entity('message_recipients')
@Unique('UQ_message_recipient', ['messageId', 'recipientId'])
@Index('IDX_msg_recipients_recipient_id', ['recipientId'])
export class MessageRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => Message, (m) => m.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;
}
