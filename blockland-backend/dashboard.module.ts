// =============================================================================
// src/modules/dashboard/dashboard.controller.ts
// BlockLand Zimbabwe — Dashboard Controller
// =============================================================================
//
// ROUTES:
//   GET /api/v1/dashboard/summary   — role-specific summary counts
//   GET /api/v1/dashboard/activity  — paginated activity feed for current user
// =============================================================================

import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard';
import { CurrentUser }      from '../../common/decorators/roles.decorator';
import { JwtPayload }       from '../auth/strategies/jwt.strategy';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/v1/dashboard/summary
   * Returns role-appropriate summary counts and last 10 activity entries.
   * All authenticated roles — content varies by role.
   */
  @ApiOperation({ summary: 'Get role-specific dashboard summary (all authenticated roles)' })
  @Get('summary')
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user);
  }

  /**
   * GET /api/v1/dashboard/activity?page=1&limit=20
   * Paginated activity feed showing the caller's recent actions.
   */
  @ApiOperation({ summary: 'Get paginated activity feed for current user' })
  @Get('activity')
  getActivityFeed(
    @CurrentUser()      user:  JwtPayload,
    @Query('page')      page:  number = 1,
    @Query('limit')     limit: number = 20,
  ) {
    return this.dashboardService.getActivityFeed(user, page, limit);
  }
}

// =============================================================================
// src/modules/dashboard/dashboard.module.ts
// =============================================================================

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { Property }         from '../../database/entities/property.entity';
import { Transfer }         from '../../database/entities/transfer.entity';
import { Dispute }          from '../../database/entities/dispute.entity';
import { ActivityLog }      from '../../database/entities/activity-log.entity';
import { Module as NestModule } from '@nestjs/common';

@NestModule({
  imports:     [TypeOrmModule.forFeature([Property, Transfer, Dispute, ActivityLog])],
  controllers: [DashboardController],
  providers:   [DashboardService],
})
export class DashboardModule {}
