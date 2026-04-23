import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property }        from '../../database/entities/property.entity';
import { VerificationLog } from '../../database/entities/verification-log.entity';
import { VerificationService }    from './verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Property, VerificationLog])],
  controllers: [VerificationController],
  providers:   [VerificationService],
})
export class VerificationModule {}
