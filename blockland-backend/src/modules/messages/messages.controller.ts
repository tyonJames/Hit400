import {
  Controller, Get, Post, Param, Query, Body,
  UseInterceptors, UploadedFile, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response }          from 'express';
import { MessagesService }   from './messages.service';
import { SendMessageDto }    from './dto/send-message.dto';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 5 * 1024 * 1024 } }))
  send(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.messagesService.send(dto, user, file);
  }

  @Get('inbox')
  getInbox(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getInbox(user.sub);
  }

  @Get('sent')
  getSent(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getSent(user.sub);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getUnreadCount(user.sub);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messagesService.getById(id, user.sub);
  }

  @Get(':id/attachment')
  async serveAttachment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType, fileName } = await this.messagesService.serveAttachment(id, user.sub);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    });
    return stream;
  }
}
