import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule }  from '@nestjs/platform-express';
import { Property }         from '../../database/entities/property.entity';
import { User }             from '../../database/entities/user.entity';
import { OwnershipRecord }  from '../../database/entities/ownership-record.entity';
import { PropertyDocument } from '../../database/entities/property-document.entity';
import { PropertyService }    from './property.service';
import { PropertyController } from './property.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, User, OwnershipRecord, PropertyDocument]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [PropertyController],
  providers:   [PropertyService],
  exports:     [PropertyService],
})
export class PropertyModule {}
