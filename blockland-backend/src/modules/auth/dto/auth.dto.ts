import {
  IsEmail, IsString, MinLength, IsOptional, Matches, Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Tendai Moyo' })
  @IsString()
  @MinLength(3)
  fullName: string;

  @ApiProperty({ example: '63-012345X-00' })
  @IsString()
  nationalId: string;

  @ApiProperty({ example: 'tendai@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '0771234567' })
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone must be 10-15 digits.' })
  phone: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' })
  @IsOptional()
  @IsString()
  walletAddress?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'tendai@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'tendai@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
