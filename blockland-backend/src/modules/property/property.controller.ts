import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PropertyService }      from './property.service';
import { RegisterPropertyDto }  from './dto/register-property.dto';
import { DeclinePropertyDto }   from './dto/decline-property.dto';
import { CurrentUser }          from '../../common/decorators/current-user.decorator';
import { Roles }                from '../../common/decorators/roles.decorator';
import { UserRole, PropertyStatus } from '../../database/enums';
import { JwtPayload }           from '../auth/strategies/jwt.strategy';

@ApiTags('properties')
@ApiBearerAuth('access-token')
@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @Roles(UserRole.USER, UserRole.REGISTRAR, UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'images',               maxCount: 10 },
    { name: 'titleDeed',            maxCount: 1  },
    { name: 'surveyDiagram',        maxCount: 1  },
    { name: 'buildingPlan',         maxCount: 1  },
    { name: 'deedOfTransfer',       maxCount: 1  },
    { name: 'taxClearance',         maxCount: 1  },
    { name: 'landDisputeAffidavit', maxCount: 1  },
  ]))
  submit(
    @Body() dto: RegisterPropertyDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: {
      images?:               Express.Multer.File[];
      titleDeed?:            Express.Multer.File[];
      surveyDiagram?:        Express.Multer.File[];
      buildingPlan?:         Express.Multer.File[];
      deedOfTransfer?:       Express.Multer.File[];
      taxClearance?:         Express.Multer.File[];
      landDisputeAffidavit?: Express.Multer.File[];
    },
  ) {
    return this.propertyService.submit(dto, files ?? {}, user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertyService.approve(id, user);
  }

  @Patch(':id/decline')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  decline(
    @Param('id') id: string,
    @Body() dto: DeclinePropertyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertyService.decline(id, dto.comment, user);
  }

  @Get()
  findAll(
    @Query('page')       page?: number,
    @Query('limit')      limit?: number,
    @Query('status')     status?: PropertyStatus,
    @Query('zoningType') zoningType?: string,
    @Query('search')     search?: string,
  ) {
    return this.propertyService.findAll({ page, limit, status, zoningType, search });
  }

  @Get('my')
  getMyPortfolio(@CurrentUser() user: JwtPayload) {
    return this.propertyService.getMyPortfolio(user.sub);
  }

  @Get('owner/:userId')
  findByOwner(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.propertyService.findByOwner(userId, { page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }
}
