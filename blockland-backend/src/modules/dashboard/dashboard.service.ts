import { Injectable }        from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { Property }          from '../../database/entities/property.entity';
import { Transfer }          from '../../database/entities/transfer.entity';
import { Dispute }           from '../../database/entities/dispute.entity';
import { ActivityLog }       from '../../database/entities/activity-log.entity';
import { PropertyStatus, TransferStatus, DisputeStatus, UserRole } from '../../database/enums';
import { JwtPayload }        from '../auth/strategies/jwt.strategy';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Property)    private propertyRepo: Repository<Property>,
    @InjectRepository(Transfer)    private transferRepo: Repository<Transfer>,
    @InjectRepository(Dispute)     private disputeRepo: Repository<Dispute>,
    @InjectRepository(ActivityLog) private logRepo: Repository<ActivityLog>,
  ) {}

  async getSummary(user: JwtPayload) {
    const isAdmin     = user.roles.includes(UserRole.ADMIN);
    const isRegistrar = user.roles.includes(UserRole.REGISTRAR);
    const isPrivileged = isAdmin || isRegistrar;

    const [totalProperties, pendingTransfers, activeDisputes, pendingApprovals] = await Promise.all([
      isPrivileged
        ? this.propertyRepo.count({ where: { status: PropertyStatus.ACTIVE } })
        : this.propertyRepo.count({ where: { currentOwnerId: user.sub, status: PropertyStatus.ACTIVE } }),
      isPrivileged
        ? this.transferRepo.count({ where: [
            { status: TransferStatus.PENDING_BUYER },
            { status: TransferStatus.PENDING_REGISTRAR },
          ]})
        : this.transferRepo.count({ where: [
            { sellerId: user.sub, status: TransferStatus.PENDING_BUYER },
            { buyerId: user.sub,  status: TransferStatus.PENDING_BUYER },
          ]}),
      this.disputeRepo.count({ where: { status: DisputeStatus.OPEN } }),
      isPrivileged
        ? this.propertyRepo.count({ where: { status: PropertyStatus.PENDING_APPROVAL } })
        : 0,
    ]);

    const recentActivity = await this.logRepo.find({
      where:     isPrivileged ? {} : { userId: user.sub },
      order:     { performedAt: 'DESC' },
      take:      10,
      relations: ['user'],
    });

    return { role: user.roles[0] ?? 'PUBLIC', totalProperties, pendingTransfers, activeDisputes, pendingApprovals, recentActivity };
  }

  async getActivity(params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.logRepo.findAndCount({
      order:     { performedAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['user'],
    });
    return { data, total, page, limit };
  }
}
