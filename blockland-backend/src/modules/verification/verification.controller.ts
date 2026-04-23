import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiTags }              from '@nestjs/swagger';
import { Request }              from 'express';
import { VerificationService }  from './verification.service';
import { Public }               from '../../common/decorators/public.decorator';

@ApiTags('verification')
@Controller('verify')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Public()
  @Get()
  verify(
    @Query('plotNumber') plotNumber?: string,
    @Query('titleDeedNumber') titleDeedNumber?: string,
    @Query('ownerId') ownerId?: string,
    @Req() req?: Request,
  ) {
    return this.verificationService.verify({ plotNumber, titleDeedNumber, ownerId }, req?.ip);
  }

  @Public()
  @Get(':propertyId')
  verifyById(@Param('propertyId') propertyId: string, @Req() req: Request) {
    return this.verificationService.verifyById(propertyId, req.ip);
  }
}
