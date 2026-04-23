import {
  Controller, Get, Post, Param, Query, Body,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor }   from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PropertyService }      from './property.service';
import { RegisterPropertyDto }  from './dto/register-property.dto';
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
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('titleDeedFile'))
  register(
    @Body() dto: RegisterPropertyDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // In production, upload the file to IPFS first; here we use a placeholder
    const ipfsHash = file ? `ipfs-${Date.now()}` : 'ipfs-placeholder';
    return this.propertyService.register(dto, ipfsHash, user);
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
