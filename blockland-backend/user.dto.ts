// =============================================================================
// src/modules/auth/dto/user.dto.ts
// BlockLand Zimbabwe — User Profile & Password Reset DTOs (added in P5)
// =============================================================================

import {
  IsEmail, IsString, IsOptional, Length, Matches, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// ForgotPasswordDto — POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------
export class ForgotPasswordDto {
  /**
   * email — the address to send the password reset link to.
   * The endpoint always returns 200 regardless of whether the email exists
   * to prevent user enumeration attacks.
   */
  @ApiProperty({ example: 'tinotenda@blockland.co.zw' })
  @IsEmail()
  email: string;
}

// ---------------------------------------------------------------------------
// ResetPasswordDto — POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------
export class ResetPasswordDto {
  /** token — the short-lived reset token from the emailed link */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  /** newPassword — must meet the same strength rules as registration */
  @ApiProperty({ example: 'NewSecurePass@2024!' })
  @IsString()
  @Length(8, 32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._\-#])/, {
    message: 'newPassword must contain uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}

// ---------------------------------------------------------------------------
// UpdateProfileDto — PATCH /api/v1/users/me
// ---------------------------------------------------------------------------
export class UpdateProfileDto {
  /**
   * Only these fields are updatable via this endpoint.
   * email and national_id changes require admin verification (separate flow).
   * Role and password changes have dedicated endpoints.
   */
  @ApiPropertyOptional({ example: 'Tinotenda J. Moyo' })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'fullName may only contain letters, spaces, hyphens, and apostrophes' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0779876543' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'phone must be 10–15 digits with no spaces' })
  phone?: string;
}

// ---------------------------------------------------------------------------
// ChangePasswordDto — PATCH /api/v1/users/me/password
// ---------------------------------------------------------------------------
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass@2024!' })
  @IsString()
  @Length(8, 32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._\-#])/, {
    message: 'newPassword must meet strength requirements',
  })
  newPassword: string;
}
