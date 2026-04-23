import { IsString, IsUUID, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DisputeType } from '../../../database/enums';

export class CreateDisputeDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({ enum: DisputeType })
  @IsEnum(DisputeType)
  disputeType: DisputeType;

  @ApiProperty({ minLength: 20, maxLength: 1000 })
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  description: string;
}
