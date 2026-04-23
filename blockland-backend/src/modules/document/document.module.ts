import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule }  from '@nestjs/platform-express';
import { PropertyDocument } from '../../database/entities/property-document.entity';
import { Property }         from '../../database/entities/property.entity';
import { DocumentService }    from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyDocument, Property]),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }), // 5 MB
  ],
  controllers: [DocumentController],
  providers:   [DocumentService],
  exports:     [DocumentService],
})
export class DocumentModule {}
