// =============================================================================
// src/modules/dashboard/dashboard.service.ts
// BlockLand Zimbabwe — Dashboard Service
// =============================================================================
//
// MODULE:  DashboardModule
// PURPOSE: Provides role-specific summary counts and activity feed for the
//          authenticated user's dashboard. DB-only reads — no blockchain calls.
//
// ROLE-SPECIFIC RESPONSES:
//   REGISTRAR/ADMIN : sees system-wide totals + pending queues
//   OWNER           : sees their own portfolio counts + recent transfers
//   BUYER           : sees incoming pending transfers awaiting their approval
//   PUBLIC          : sees only system-wide property count (read-only stats)
// =============================================================================

import { Injectable }        from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';

import { Property }          from '../../database/entities/property.entity';
import { Transfer }          from '../../database/entities/transfer.entity';
import { Dispute }           from '../../database/entities/dispute.entity';
import { ActivityLog }       from '../../database/entities/activity-log.entity';
import {
  PropertyStatus, TransferStatus, DisputeStatus, UserRole,
} from '../../database/enums';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

export interface DashboardSummary {
  role:             UserRole | string;
  totalProperties:  number;
  pendingTransfers: number;
  activeDisputes:   number;
  recentActivity:   ActivityLog[];
  // Registrar/Admin extras
  systemTotals?:    { users: number; properties: number; transfers: number; disputes: number };
  // Buyer extra
  incomingPendingApprovals?: number;
}

@Injectable()
export class DashboardService {

  constructor(
    @InjectRepository(Property)    private readonly propertyRepo:  Repository<Property>,
    @InjectRepository(Transfer)    private readonly transferRepo:  Repository<Transfer>,
    @InjectRepository(Dispute)     private readonly disputeRepo:   Repository<Dispute>,
    @InjectRepository(ActivityLog) private readonly activityRepo:  Repository<ActivityLog>,
  ) {}

  /**
   * getSummary — returns dashboard summary counts tailored to the caller's role.
   *
   * @param caller — the authenticated user's JWT payload (contains roles + sub)
   */
  async getSummary(caller: JwtPayload): Promise<DashboardSummary> {
    const roles = caller.roles;
    const userId = caller.sub;

    const isRegistrar = roles.includes(UserRole.REGISTRAR);
    const isAdmin     = roles.includes(UserRole.ADMIN);
    const isBuyer     = roles.includes(UserRole.BUYER);

    // Fetch the last 10 activity log entries for this user
    const recentActivity = await this.activityRepo.find({
      where: { userId },
      order: { performedAt: 'DESC' },
      take:  10,
    });

    if (isRegistrar || isAdmin) {
      // Registrar/Admin: system-wide counts
      const [totalProperties, pendingTransfers, activeDisputes] = await Promise.all([
        this.propertyRepo.count(),
        this.transferRepo.count({ where: { status: TransferStatus.PENDING_REGISTRAR } }),
        this.disputeRepo.count({ where: [
          { status: DisputeStatus.OPEN },
          { status: DisputeStatus.UNDER_REVIEW },
        ]}),
      ]);

      return {
        role: isAdmin ? UserRole.ADMIN : UserRole.REGISTRAR,
        totalProperties,
        pendingTransfers,
        activeDisputes,
        recentActivity,
      };
    }

    if (isBuyer) {
      const [ownedCount, incomingApprovals] = await Promise.all([
        this.propertyRepo.count({ where: { currentOwnerId: userId } }),
        this.transferRepo.count({ where: { buyerId: userId, status: TransferStatus.PENDING_BUYER } }),
      ]);
      return {
        role: UserRole.BUYER,
        totalProperties: ownedCount,
        pendingTransfers: incomingApprovals,
        activeDisputes:  0,
        recentActivity,
        incomingPendingApprovals: incomingApprovals,
      };
    }

    // OWNER / PUBLIC: own portfolio counts
    const [totalProperties, pendingTransfers, activeDisputes] = await Promise.all([
      this.propertyRepo.count({ where: { currentOwnerId: userId } }),
      this.transferRepo.count({ where: { sellerId: userId, status: TransferStatus.PENDING_BUYER } }),
      this.disputeRepo.count({ where: { raisedById: userId, status: DisputeStatus.OPEN } }),
    ]);

    return {
      role: UserRole.OWNER,
      totalProperties,
      pendingTransfers,
      activeDisputes,
      recentActivity,
    };
  }

  /**
   * getActivityFeed — returns paginated activity logs for the current user.
   *
   * @param caller — the authenticated user
   * @param page   — page number (1-based)
   * @param limit  — items per page (max 50)
   */
  async getActivityFeed(
    caller: JwtPayload,
    page   = 1,
    limit  = 20,
  ): Promise<{ data: ActivityLog[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.activityRepo.findAndCount({
      where: { userId: caller.sub },
      order: { performedAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  Math.min(limit, 50),
    });
    return { data, total, page, limit };
  }
}
