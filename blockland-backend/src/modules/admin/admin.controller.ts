import { Controller, Get, Post, Delete, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService }  from './admin.service';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { UserRole }      from '../../database/enums';
import { JwtPayload }    from '../auth/strategies/jwt.strategy';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('registrars')
  getRegistrars() { return this.adminService.getRegistrars(); }

  @Post('registrars')
  addRegistrar(@Body('userId') userId: string) { return this.adminService.addRegistrar(userId); }

  @Delete('registrars/:userId')
  removeRegistrar(@Param('userId') userId: string) { return this.adminService.removeRegistrar(userId); }

  @Get('logs')
  getLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getLogs({ page, limit });
  }

  @Get('stats')
  getStats() { return this.adminService.getStats(); }

  @Get('users')
  listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({ page, limit, search });
  }

  @Patch('users/:userId/status')
  updateStatus(@Param('userId') userId: string, @Body('isActive') isActive: boolean) {
    return this.adminService.updateUserStatus(userId, isActive);
  }

  @Get('users/pending')
  getPendingUsers() {
    return this.adminService.getPendingUsers();
  }

  @Post('users/:userId/approve')
  approveUser(
    @Param('userId') userId: string,
    @Body('roles') roles: UserRole[],
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.approveUser(userId, roles, admin.sub);
  }
}
