import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transfer }           from '../../database/entities/transfer.entity';
import { Property }           from '../../database/entities/property.entity';
import { User }               from '../../database/entities/user.entity';
import { TransferApproval }   from '../../database/entities/transfer-approval.entity';
import { OwnershipRecord }    from '../../database/entities/ownership-record.entity';
import { MarketplaceListing } from '../../database/entities/marketplace-listing.entity';
import { TransferService }    from './transfer.service';
import { TransferController } from './transfer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    Transfer, Property, User, TransferApproval, OwnershipRecord, MarketplaceListing,
  ])],
  controllers: [TransferController],
  providers:   [TransferService],
  exports:     [TransferService],
})
export class TransferModule {}
