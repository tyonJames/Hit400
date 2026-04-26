import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceService }  from './marketplace.service';
import { CreateListingDto }    from './dto/create-listing.dto';
import { ExpressInterestDto }  from './dto/express-interest.dto';
import { CurrentUser }         from '../../common/decorators/current-user.decorator';
import { Roles }               from '../../common/decorators/roles.decorator';
import { UserRole }            from '../../database/enums';
import { JwtPayload }          from '../auth/strategies/jwt.strategy';

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ── Listings ──────────────────────────────────────────────────────────────

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page')     page?:     number,
    @Query('limit')    limit?:    number,
    @Query('search')   search?:   string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    return this.marketplaceService.findAll({ page, limit, search, minPrice, maxPrice });
  }

  @Get('my')
  @Roles(UserRole.USER, UserRole.REGISTRAR, UserRole.ADMIN)
  findMy(@CurrentUser() user: JwtPayload) {
    return this.marketplaceService.findBySeller(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.marketplaceService.findOne(id, user.sub);
  }

  @Post()
  @Roles(UserRole.USER, UserRole.REGISTRAR)
  create(@Body() dto: CreateListingDto, @CurrentUser() user: JwtPayload) {
    return this.marketplaceService.createListing(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.USER, UserRole.REGISTRAR)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateListingDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.marketplaceService.updateListing(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.USER, UserRole.REGISTRAR)
  delist(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.marketplaceService.delistListing(id, user);
  }

  // ── Interests ─────────────────────────────────────────────────────────────

  @Get(':id/interests')
  getInterests(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.marketplaceService.getInterests(id, user);
  }

  @Post(':id/interest')
  @Roles(UserRole.USER)
  expressInterest(
    @Param('id') id: string,
    @Body() dto: ExpressInterestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.marketplaceService.expressInterest(id, dto, user);
  }

  @Delete(':id/interest')
  @Roles(UserRole.USER)
  withdrawInterest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.marketplaceService.withdrawInterest(id, user);
  }

  // ── Select buyer → initiate transfer ─────────────────────────────────────

  @Post(':id/select/:interestId')
  @Roles(UserRole.USER, UserRole.REGISTRAR)
  selectBuyer(
    @Param('id') id: string,
    @Param('interestId') interestId: string,
    @Body('paymentMethod') paymentMethod: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.marketplaceService.selectBuyer(id, interestId, paymentMethod, user);
  }
}
