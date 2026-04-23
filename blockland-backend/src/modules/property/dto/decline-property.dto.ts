import { IsString, MaxLength } from 'class-validator';
import { ApiProperty }         from '@nestjs/swagger';

export class DeclinePropertyDto {
  @ApiProperty({ description: 'Reason for declining the registration', example: 'Missing supporting documents.' })
  @IsString()
  @MaxLength(500)
  comment: string;
}
