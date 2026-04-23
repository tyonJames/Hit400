import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '63-012345X-00' })
  @IsString()
  @MaxLength(20)
  nationalId: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '0771234567' })
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone must be 10-15 digits.' })
  phone: string;

  @ApiProperty({ example: 'StrongP@ss1' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' })
  @IsOptional()
  @IsString()
  walletAddress?: string;
}
