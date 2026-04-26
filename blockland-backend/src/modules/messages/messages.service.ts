import {
  Injectable, NotFoundException, ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as fs   from 'fs';
import * as path from 'path';
import { Message }           from '../../database/entities/message.entity';
import { MessageRecipient }  from '../../database/entities/message-recipient.entity';
import { Transfer }          from '../../database/entities/transfer.entity';
import { User }              from '../../database/entities/user.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';
import { SendMessageDto }    from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)          private messageRepo: Repository<Message>,
    @InjectRepository(MessageRecipient) private recipientRepo: Repository<MessageRecipient>,
    @InjectRepository(Transfer)         private transferRepo: Repository<Transfer>,
    @InjectRepository(User)             private userRepo: Repository<User>,
    private dataSource:         DataSource,
    private activityLogService: ActivityLogService,
  ) {}

  private async resolveRecipients(transferId: string | undefined, senderId: string): Promise<string[]> {
    const ids = new Set<string>();

    if (transferId) {
      const transfer = await this.transferRepo.findOne({ where: { id: transferId } });
      if (transfer) {
        ids.add(transfer.sellerId);
        ids.add(transfer.buyerId);
      }
    }

    // Always include all registrars and admins so they're never left out
    const staff = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.userRoles', 'ur')
      .innerJoin('ur.role', 'r')
      .where('r.name IN (:...roles)', { roles: ['REGISTRAR', 'ADMIN'] })
      .getMany();
    staff.forEach((u) => ids.add(u.id));

    // Don't send to yourself
    ids.delete(senderId);
    return [...ids];
  }

  async send(
    dto: SendMessageDto,
    sender: JwtPayload,
    file?: Express.Multer.File,
  ): Promise<Message> {
    let attachmentFileName: string | null = null;
    let attachmentFilePath: string | null = null;
    let attachmentFileSize: number | null = null;

    if (file) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'message-attachments');
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext      = (file.originalname.split('.').pop() ?? 'bin').toLowerCase();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const diskPath = path.join(uploadDir, safeName);
      fs.writeFileSync(diskPath, file.buffer);
      attachmentFileName = file.originalname;
      attachmentFilePath = diskPath;
      attachmentFileSize = file.size;
    }

    const recipientIds = await this.resolveRecipients(dto.transferId, sender.sub);

    const message = await this.dataSource.transaction(async (em) => {
      const msg = em.create(Message, {
        senderId:           sender.sub,
        transferId:         dto.transferId ?? null,
        subject:            dto.subject,
        body:               dto.body,
        attachmentFileName,
        attachmentFilePath,
        attachmentFileSize,
      });
      await em.save(msg);

      for (const recipientId of recipientIds) {
        await em.save(em.create(MessageRecipient, {
          messageId:   msg.id,
          recipientId,
          readAt:      null,
        }));
      }
      return msg;
    });

    await this.activityLogService.log({
      userId: sender.sub, action: 'MESSAGE_SENT',
      entityType: 'Message', entityId: message.id,
      metadata: { subject: dto.subject, transferId: dto.transferId, recipientCount: recipientIds.length },
    });

    return this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['sender', 'transfer', 'transfer.property', 'recipients', 'recipients.recipient'],
    }) as Promise<Message>;
  }

  async getInbox(userId: string, params: { page?: number; limit?: number }) {
    const page  = +(params.page  ?? 1) || 1;
    const limit = +(params.limit ?? 20) || 20;

    const [rows, total] = await this.messageRepo
      .createQueryBuilder('m')
      .innerJoin('m.recipients', 'r', 'r.recipient_id = :uid', { uid: userId })
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.transfer', 't')
      .leftJoinAndSelect('t.property', 'p')
      .addSelect('r.read_at', 'readAt')
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Attach readAt per message for this user
    const withRead = await Promise.all(rows.map(async (msg) => {
      const rec = await this.recipientRepo.findOne({
        where: { messageId: msg.id, recipientId: userId },
      });
      return { ...msg, readAt: rec?.readAt ?? null };
    }));

    return { data: withRead, total, page, limit };
  }

  async getSent(userId: string, params: { page?: number; limit?: number }) {
    const page  = +(params.page  ?? 1) || 1;
    const limit = +(params.limit ?? 20) || 20;

    const [data, total] = await this.messageRepo.findAndCount({
      where:     { senderId: userId },
      relations: ['transfer', 'transfer.property', 'recipients', 'recipients.recipient'],
      order:     { createdAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
    });

    return { data, total, page, limit };
  }

  async getById(id: string, userId: string): Promise<Message & { readAt: Date | null }> {
    const message = await this.messageRepo.findOne({
      where:     { id },
      relations: ['sender', 'transfer', 'transfer.property', 'recipients', 'recipients.recipient'],
    });
    if (!message) throw new NotFoundException('Message not found.');

    const isRecipient = await this.recipientRepo.findOne({ where: { messageId: id, recipientId: userId } });
    const isSender    = message.senderId === userId;
    if (!isRecipient && !isSender) throw new ForbiddenException('Access denied.');

    // Mark as read if recipient and not yet read
    if (isRecipient && !isRecipient.readAt) {
      isRecipient.readAt = new Date();
      await this.recipientRepo.save(isRecipient);
    }

    return { ...message, readAt: isRecipient?.readAt ?? null };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.recipientRepo.count({
      where: { recipientId: userId, readAt: null as any },
    });
  }

  async serveAttachment(messageId: string, userId: string) {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found.');

    const isRecipient = await this.recipientRepo.findOne({ where: { messageId, recipientId: userId } });
    if (!isRecipient && message.senderId !== userId) throw new ForbiddenException('Access denied.');

    if (!message.attachmentFilePath || !fs.existsSync(message.attachmentFilePath)) {
      throw new NotFoundException('Attachment not found.');
    }

    const ext = path.extname(message.attachmentFilePath).slice(1).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    };
    const contentType = contentTypeMap[ext] ?? 'application/octet-stream';
    const stream = fs.createReadStream(message.attachmentFilePath);
    return { stream: new StreamableFile(stream), contentType, fileName: message.attachmentFileName ?? 'attachment' };
  }
}
