import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth }         from '@nestjs/swagger';
import { OwnershipService }               from './ownership.service';

@ApiTags('ownership')
@ApiBearerAuth('access-token')
@Controller('ownership')
export class OwnershipController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Get(':propertyId/history')
  getHistory(
    @Param('propertyId') propertyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ownershipService.getHistory(propertyId, { page, limit });
  }

  @Get(':propertyId/history/onchain')
  getOnChainHistory(@Param('propertyId') propertyId: string) {
    return this.ownershipService.getOnChainHistory(propertyId);
  }
}
