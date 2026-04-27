import {
  Controller, Get, Patch, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService }  from './users.service';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { JwtPayload }    from '../auth/strategies/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: { fullName?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(user.sub, body);
  }

  @Patch('me/wallet')
  linkWallet(@CurrentUser() user: JwtPayload, @Body() body: { walletAddress: string }) {
    return this.usersService.linkWallet(user.sub, body.walletAddress);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }

  /** Search for a buyer by Blockland ID (for /transfers/new buyer picker). */
  @Get('search')
  searchByBlocklandId(@Query('blocklandId') blocklandId: string) {
    if (!blocklandId?.startsWith('BL-')) return null;
    return this.usersService.searchByBlocklandId(blocklandId);
  }

  @Get()
  list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.list({ page: Number(page) || 1, limit: Number(limit) || 20, search });
  }
}
