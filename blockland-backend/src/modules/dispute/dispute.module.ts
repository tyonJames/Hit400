import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute }           from '../../database/entities/dispute.entity';
import { Property }          from '../../database/entities/property.entity';
import { DisputeEvidence }   from '../../database/entities/dispute-evidence.entity';
import { DisputeResolution } from '../../database/entities/dispute-resolution.entity';
import { TransferModule }    from '../transfer/transfer.module';
import { DisputeService }    from './dispute.service';
import { DisputeController } from './dispute.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Property, DisputeEvidence, DisputeResolution]),
    TransferModule,
  ],
  controllers: [DisputeController],
  providers:   [DisputeService],
  exports:     [DisputeService],
})
export class DisputeModule {}
