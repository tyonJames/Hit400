import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property }        from '../../database/entities/property.entity';
import { User }            from '../../database/entities/user.entity';
import { VerificationLog } from '../../database/entities/verification-log.entity';
import { VerificationService }    from './verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Property, User, VerificationLog])],
  controllers: [VerificationController],
  providers:   [VerificationService],
})
export class VerificationModule {}
