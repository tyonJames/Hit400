import { IsUUID, IsNumber, IsString, IsArray, Min, MaxLength, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  minPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  maxPrice: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  paymentMethods: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  description: string;
}
