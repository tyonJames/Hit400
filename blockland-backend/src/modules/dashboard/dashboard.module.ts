import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property }      from '../../database/entities/property.entity';
import { Transfer }      from '../../database/entities/transfer.entity';
import { Dispute }       from '../../database/entities/dispute.entity';
import { ActivityLog }   from '../../database/entities/activity-log.entity';
import { DashboardService }    from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Property, Transfer, Dispute, ActivityLog])],
  controllers: [DashboardController],
  providers:   [DashboardService],
})
export class DashboardModule {}
