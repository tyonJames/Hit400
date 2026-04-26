import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule }  from '@nestjs/platform-express';
import { Message }           from '../../database/entities/message.entity';
import { MessageRecipient }  from '../../database/entities/message-recipient.entity';
import { Transfer }          from '../../database/entities/transfer.entity';
import { User }              from '../../database/entities/user.entity';
import { MessagesService }    from './messages.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageRecipient, Transfer, User]),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [MessagesController],
  providers:   [MessagesService],
  exports:     [MessagesService],
})
export class MessagesModule {}
