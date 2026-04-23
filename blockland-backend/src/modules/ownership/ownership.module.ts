import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property }      from '../../database/entities/property.entity';
import { OwnershipRecord } from '../../database/entities/ownership-record.entity';
import { OwnershipService }    from './ownership.service';
import { OwnershipController } from './ownership.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Property, OwnershipRecord])],
  controllers: [OwnershipController],
  providers:   [OwnershipService],
})
export class OwnershipModule {}
