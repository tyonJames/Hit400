import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User }        from '../../database/entities/user.entity';
import { Role }        from '../../database/entities/role.entity';
import { UserRole }    from '../../database/entities/user-role.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { AdminService }    from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([User, Role, UserRole, ActivityLog])],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}
