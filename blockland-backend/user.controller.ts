// =============================================================================
// src/modules/auth/user.controller.ts
// BlockLand Zimbabwe — User Profile Controller (new in P5)
// =============================================================================
//
// MODULE:  AuthModule
// PURPOSE: Handles /api/v1/users endpoints for profile reading and updating.
//          Separated from AuthController (which handles /auth/* login flows).
//
// ROUTES:
//   GET    /api/v1/users/me             — get own profile (all auth roles)
//   PATCH  /api/v1/users/me             — update own profile fields
//   PATCH  /api/v1/users/me/wallet      — link Stacks wallet
//   PATCH  /api/v1/users/me/password    — change own password
//   GET    /api/v1/users                — list all users (ADMIN only)
//   PATCH  /api/v1/users/:id/role       — assign role (ADMIN only)
//   PATCH  /api/v1/users/:id/status     — activate/deactivate (ADMIN only)
// =============================================================================

import {
  Controller, Get, Patch, Body, Query,
  UseGuards, ParseUUIDPipe, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import * as bcrypt           from 'bcrypt';

import { User }              from '../../database/entities/user.entity';
import { AuthService }       from './auth.service';
import { JwtAuthGuard }      from '../../common/guards/jwt-auth.guard';
import { RolesGuard }        from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { UserRole }          from '../../database/enums';
import { JwtPayload }        from './strategies/jwt.strategy';
import { LinkWalletDto, AssignRoleDto } from './dto/auth.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/user.dto';
import {
  UnauthorizedException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminService }       from '../admin/admin.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {

  constructor(
    private readonly authService:     AuthService,
    private readonly adminService:    AdminService,
    private readonly activityLog:     ActivityLogService,
    @InjectRepository(User)
    private readonly userRepo:        Repository<User>,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /api/v1/users/me
  // ---------------------------------------------------------------------------

  /** Returns the authenticated user's own profile (password hash excluded) */
  @ApiOperation({ summary: 'Get own user profile' })
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/users/me
  // ---------------------------------------------------------------------------

  /**
   * Updates mutable profile fields (fullName, phone).
   * email and nationalId cannot be changed via this endpoint.
   */
  @ApiOperation({ summary: 'Update own profile (fullName and/or phone)' })
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const updates: Partial<User> = {};
    if (dto.fullName) updates.fullName = dto.fullName;
    if (dto.phone)    updates.phone    = dto.phone;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No updatable fields provided (fullName, phone).');
    }

    await this.userRepo.update(user.sub, updates);

    await this.activityLog.log({
      userId:     user.sub,
      action:     'PROFILE_UPDATED',
      entityType: 'User',
      entityId:   user.sub,
      metadata:   { fields: Object.keys(updates) },
    });

    return this.authService.getProfile(user.sub);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/users/me/wallet
  // ---------------------------------------------------------------------------

  /** Links or updates the Stacks wallet address on the user account */
  @ApiOperation({ summary: 'Link a Stacks wallet address to user account' })
  @Patch('me/wallet')
  @HttpCode(HttpStatus.OK)
  linkWallet(@CurrentUser() user: JwtPayload, @Body() dto: LinkWalletDto) {
    return this.authService.linkWallet(user.sub, dto.walletAddress);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/users/me/password
  // ---------------------------------------------------------------------------

  /**
   * Changes the authenticated user's own password.
   * Requires the current password to prevent unauthorised changes.
   */
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    const dbUser = await this.userRepo.findOneBy({ id: user.sub });
    if (!dbUser) throw new NotFoundException('User not found.');

    // Verify the current password before allowing the change
    const valid = await bcrypt.compare(dto.currentPassword, dbUser.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.update(user.sub, { passwordHash: newHash });

    await this.activityLog.log({
      userId:     user.sub,
      action:     'PASSWORD_CHANGED',
      entityType: 'User',
      entityId:   user.sub,
    });

    return { message: 'Password changed successfully.' };
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/users (ADMIN only)
  // ---------------------------------------------------------------------------

  /** Lists all users with pagination and optional role filter */
  @ApiOperation({ summary: 'List all users with pagination (Admin only)' })
  @Get()
  @Roles(UserRole.ADMIN)
  listUsers(
    @Query('page')  page:  number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.adminService.listUsers(page, limit);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/users/:id/role (ADMIN only)
  // ---------------------------------------------------------------------------

  /**
   * Assigns a role to a user.
   * Assigning REGISTRAR also calls initialize-registrar on the Clarity contract.
   */
  @ApiOperation({ summary: 'Assign a role to a user (Admin only)' })
  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.assignRole(id, dto, admin);
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/users/:id/status (ADMIN only)
  // ---------------------------------------------------------------------------

  /** Activates or deactivates a user account */
  @ApiOperation({ summary: 'Activate or deactivate a user account (Admin only)' })
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() admin: JwtPayload,
  ) {
    return isActive
      ? this.adminService.activateUser(id, admin)
      : this.adminService.deactivateUser(id, admin);
  }
}
