import {
  Controller, Post, Get, Param, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response }          from 'express';
import { DocumentService }   from './document.service';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('properties/:propertyId/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentService.uploadForProperty(propertyId, user.id, file);
  }

  @Get()
  getAll(@Param('propertyId') propertyId: string) {
    return this.documentService.getForProperty(propertyId);
  }

  @Get(':docId/file')
  serveFile(
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.documentService.serveFile(docId, res);
  }
}
