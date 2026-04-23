import {
  Controller, Get, Post, Patch, Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

  @Post()
  @Roles(UserRole.USER)
  initiate(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtPayload) {
    return this.transferService.initiate(dto, user);
  }

  @Get()
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TransferStatus,
  ) {
    return this.transferService.findAll({ page, limit, status });
  }

  @Get('mine')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.transferService.findMine(user.sub, { page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
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

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('notes') notes?: string,
  ) {
    return this.transferService.cancel(id, user, notes);
  }
}
