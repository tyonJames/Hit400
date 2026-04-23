import {
  Controller, Get, Post, Patch, Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DisputeService }  from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { Roles }           from '../../common/decorators/roles.decorator';
import { UserRole, DisputeStatus } from '../../database/enums';
import { JwtPayload }      from '../auth/strategies/jwt.strategy';

@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: JwtPayload) {
    return this.disputeService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: DisputeStatus,
  ) {
    return this.disputeService.findAll({ page, limit, status }, user);
  }

  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.disputeService.findMine(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  resolve(
    @Param('id') id: string,
    @Body('resolutionNotes') resolutionNotes: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.disputeService.resolve(id, resolutionNotes, user);
  }
}
