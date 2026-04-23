import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService }  from './dashboard.service';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user);
  }

  @Get('activity')
  getActivity(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.dashboardService.getActivity({ page, limit });
  }
}
