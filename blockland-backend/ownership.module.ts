// =============================================================================
// src/modules/ownership/ownership.controller.ts + ownership.module.ts
// BlockLand Zimbabwe — Ownership History Controller & Module
// =============================================================================
//
// ROUTES:
//   GET /api/v1/ownership/:propertyId/history          — DB history (paginated)
//   GET /api/v1/ownership/:propertyId/history/onchain  — on-chain history (REGISTRAR/ADMIN)
// =============================================================================

import {
  Controller, Get, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Module }              from '@nestjs/common';
import { TypeOrmModule }       from '@nestjs/typeorm';

import { OwnershipService }    from './ownership.service';
import { Property }            from '../../database/entities/property.entity';
import { OwnershipRecord }     from '../../database/entities/ownership-record.entity';
import { JwtAuthGuard }        from '../../common/guards/jwt-auth.guard';
import { RolesGuard }          from '../../common/guards/roles.guard';
import { Roles, Public }       from '../../common/decorators/roles.decorator';
import { UserRole }            from '../../database/enums';

@ApiTags('ownership')
@ApiBearerAuth('access-token')
@Controller('ownership')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnershipController {

  constructor(private readonly ownershipService: OwnershipService) {}

  /**
   * GET /api/v1/ownership/:propertyId/history?page=1&limit=20
   * Returns the ownership chain from the database.
   * All authenticated roles can access this.
   */
  @ApiOperation({ summary: 'Get paginated ownership history from DB (all authenticated roles)' })
  @Get(':propertyId/history')
  getDbHistory(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('page')  page:  number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.ownershipService.getDbHistory(propertyId, page, limit);
  }

  /**
   * GET /api/v1/ownership/:propertyId/history/onchain
   * Reads ownership history directly from the Clarity smart contract.
   * Requires multiple read-only blockchain calls — restricted to REGISTRAR/ADMIN.
   * Returns on-chain sequence, owner principals, and mismatch flag.
   */
  @ApiOperation({
    summary: 'Get on-chain ownership history from Clarity contract (Registrar/Admin only)',
    description:
      'Calls get-ownership-history-count then iterates get-ownership-history-entry. ' +
      'Returns a mismatch flag if on-chain count differs from DB count.',
  })
  @Get(':propertyId/history/onchain')
  @Roles(UserRole.REGISTRAR, UserRole.ADMIN)
  getOnChainHistory(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.ownershipService.getOnChainHistory(propertyId);
  }
}

// =============================================================================
// OwnershipModule
// =============================================================================

@Module({
  imports:     [TypeOrmModule.forFeature([Property, OwnershipRecord])],
  controllers: [OwnershipController],
  providers:   [OwnershipService],
  exports:     [OwnershipService],
})
export class OwnershipModule {}
