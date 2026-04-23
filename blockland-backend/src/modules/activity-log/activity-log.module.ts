import { Module, Global } from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { ActivityLog }    from '../../database/entities/activity-log.entity';
import { ActivityLogService } from './activity-log.service';

@Global()
@Module({
  imports:   [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService],
  exports:   [ActivityLogService],
})
export class ActivityLogModule {}
