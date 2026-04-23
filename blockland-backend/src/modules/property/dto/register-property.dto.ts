import {
  IsString, IsUUID, IsEnum, IsNumber, IsOptional, IsDateString, Min, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ZoningType, LandSizeUnit } from '../../../database/enums';

export class RegisterPropertyDto {
  @ApiProperty({ example: 'HARARE-NW-01234' })
  @IsString()
  @MaxLength(20)
  plotNumber: string;

  @ApiProperty({ example: 'TD2024/00345/H' })
  @IsString()
  @MaxLength(30)
  titleDeedNumber: string;

  @ApiProperty({ example: '45 Samora Machel Ave, Harare' })
  @IsString()
  @MaxLength(150)
  address: string;

  @ApiProperty({ example: 250.5 })
  @IsNumber()
  @Min(0.0001)
  landSize: number;

  @ApiProperty({ enum: LandSizeUnit, default: LandSizeUnit.SQM })
  @IsEnum(LandSizeUnit)
  unit: LandSizeUnit;

  @ApiProperty({ enum: ZoningType })
  @IsEnum(ZoningType)
  zoningType: ZoningType;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  registrationDate: string;

  @ApiProperty({ description: 'UUID of the new property owner (user)' })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
