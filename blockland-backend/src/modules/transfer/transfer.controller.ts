import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response }          from 'express';
import { createReadStream }  from 'fs';
import { TransferService }   from './transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { Roles }             from '../../common/decorators/roles.decorator';
import { UserRole, TransferStatus } from '../../database/enums';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@ApiTags('transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  // ── Direct flow ───────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.USER)
  initiate(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtPayload) {
    return this.transferService.initiate(dto, user);
  }

  @Patch(':id/buyer-approve')
  buyerApprove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('notes') notes?: string,
  ) {
    return this.transferService.buyerApprove(id, user, notes);
  }

  @Patch(':id/registrar-approve')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  registrarApprove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('notes') notes?: string,
  ) {
    return this.transferService.registrarApprove(id, user, notes);
  }

  // ── Marketplace flow ──────────────────────────────────────────────────────

  @Patch(':id/review-terms')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  reviewTerms(
    @Param('id') id: string,
    @Body('action') action: 'APPROVE' | 'REJECT',
    @Body('note')   note:   string,
    @CurrentUser()  user:   JwtPayload,
  ) {
    return this.transferService.registrarReviewTerms(id, action, note, user);
  }

  @Post(':id/pop')
  @Roles(UserRole.USER, UserRole.REGISTRAR)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadPop(
    @Param('id')    id:   string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser()  user: JwtPayload,
  ) {
    return this.transferService.buyerUploadPop(id, file, user);
  }

  @Get(':id/pop')
  async getPop(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName } = await this.transferService.servePop(id);
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf'
               : ext === 'png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    createReadStream(filePath).pipe(res);
  }

  @Patch(':id/seller-confirm')
  sellerConfirm(
    @Param('id')       id:        string,
    @Body('confirmed') confirmed: boolean,
    @Body('note')      note:      string,
    @CurrentUser()     user:      JwtPayload,
  ) {
    return this.transferService.sellerConfirmPayment(id, confirmed, note, user);
  }

  @Patch(':id/registrar-complete')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  registrarComplete(
    @Param('id')    id:    string,
    @CurrentUser()  user:  JwtPayload,
    @Body('notes')  notes: string,
  ) {
    return this.transferService.registrarComplete(id, user, notes);
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  findAll(
    @Query('page')   page?:   number,
    @Query('limit')  limit?:  number,
    @Query('status') status?: TransferStatus,
  ) {
    return this.transferService.findAll({ page, limit, status });
  }

  @Get('mine')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?:  number,
    @Query('limit') limit?: number,
  ) {
    return this.transferService.findMine(user.sub, { page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id')    id:   string,
    @CurrentUser()  user: JwtPayload,
    @Body('note')   note: string,
  ) {
    return this.transferService.cancel(id, user, note);
  }
}
