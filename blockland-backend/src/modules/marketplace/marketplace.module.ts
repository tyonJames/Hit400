import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceListing } from '../../database/entities/marketplace-listing.entity';
import { BuyerInterest }      from '../../database/entities/buyer-interest.entity';
import { Property }           from '../../database/entities/property.entity';
import { Transfer }           from '../../database/entities/transfer.entity';
import { User }               from '../../database/entities/user.entity';
import { MessagesModule }        from '../messages/messages.module';
import { MarketplaceService }    from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplaceListing, BuyerInterest, Property, Transfer, User]),
    MessagesModule,
  ],
  controllers: [MarketplaceController],
  providers:   [MarketplaceService],
  exports:     [MarketplaceService],
})
export class MarketplaceModule {}
