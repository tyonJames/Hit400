import {
  Injectable, UnauthorizedException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService }       from '@nestjs/jwt';
import { ConfigService }    from '@nestjs/config';
import * as bcrypt          from 'bcrypt';
import { v4 as uuidv4 }    from 'uuid';

import { User }       from '../../database/entities/user.entity';
import { Role }       from '../../database/entities/role.entity';
import { UserRole }   from '../../database/entities/user-role.entity';
import { AuthToken }  from '../../database/entities/auth-token.entity';
import { UserRole as UserRoleEnum } from '../../database/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto }    from './dto/login.dto';
import { JwtPayload }  from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)      private userRepo: Repository<User>,
    @InjectRepository(Role)      private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)  private userRoleRepo: Repository<UserRole>,
    @InjectRepository(AuthToken) private tokenRepo: Repository<AuthToken>,
    private jwtService:   JwtService,
    private configService: ConfigService,
    private dataSource:   DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // REGISTER
  // ---------------------------------------------------------------------------
  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.userRepo.findOne({ where: [
      { email: dto.email },
      { nationalId: dto.nationalId },
    ]});
    if (existing) throw new ConflictException('Email or National ID already registered.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.dataSource.transaction(async (em) => {
      const newUser = em.create(User, {
        fullName:      dto.fullName,
        nationalId:    dto.nationalId,
        email:         dto.email,
        phone:         dto.phone,
        passwordHash,
        walletAddress: dto.walletAddress || null,
        blocklandId:   await this.generateBlocklandId(),
        isActive:      true,
        isApproved:    false,
        approvedAt:    null,
        approvedById:  null,
      });
      await em.save(newUser);

      const publicRole = await this.roleRepo.findOne({ where: { name: UserRoleEnum.PUBLIC } });
      if (publicRole) {
        await em.save(UserRole, { userId: newUser.id, roleId: publicRole.id });
      }
    });

    return { pending: true, message: 'Registration successful. Your account is awaiting administrator approval.' };
  }

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------
  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.userRepo.findOne({
      where:     { email: dto.email, isActive: true },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new UnauthorizedException('Invalid email or password.');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid email or password.');

    if (!user.isApproved) {
      throw new UnauthorizedException('Your account is pending administrator approval.');
    }

    return this.generateTokens(user, ipAddress);
  }

  // ---------------------------------------------------------------------------
  // REFRESH
  // ---------------------------------------------------------------------------
  async refresh(refreshToken: string, ipAddress?: string) {
    // Find a non-revoked, non-expired token
    const tokenRecords = await this.tokenRepo.find({
      where: { revoked: false },
      relations: ['user', 'user.userRoles', 'user.userRoles.role'],
    });

    let matchedRecord: AuthToken | null = null;
    let matchedUser: User | null = null;

    for (const record of tokenRecords) {
      if (record.expiresAt < new Date()) continue;
      const match = await bcrypt.compare(refreshToken, record.tokenHash);
      if (match) {
        matchedRecord = record;
        matchedUser   = record.user;
        break;
      }
    }

    if (!matchedRecord || !matchedUser) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (!matchedUser.isActive) {
      throw new UnauthorizedException('Account deactivated.');
    }

    // Revoke the used token (rotation)
    matchedRecord.revoked = true;
    await this.tokenRepo.save(matchedRecord);

    return this.generateTokens(matchedUser, ipAddress);
  }

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------
  async logout(userId: string) {
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true });
    return { message: 'Logged out successfully.' };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  private async generateBlocklandId(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
    for (let attempt = 0; attempt < 10; attempt++) {
      let id = 'BL-';
      for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
      const exists = await this.userRepo.findOne({ where: { blocklandId: id } });
      if (!exists) return id;
    }
    throw new Error('Could not generate unique Blockland ID.');
  }

  private async generateTokens(user: User, ipAddress?: string) {
    const roles = user.userRoles?.map((ur) => ur.role?.name) ?? [];

    const payload: JwtPayload = { sub: user.id, email: user.email, roles };

    const accessToken  = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
    const refreshToken = uuidv4();

    const tokenHash  = await bcrypt.hash(refreshToken, 10);
    const expiresAt  = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.tokenRepo.save(this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      revoked:   false,
      ipAddress: ipAddress ?? null,
    }));

    return {
      accessToken,
      refreshToken,
      user: {
        id:            user.id,
        email:         user.email,
        fullName:      user.fullName,
        roles,
        walletAddress: user.walletAddress,
        blocklandId:   user.blocklandId,
      },
    };
  }
}
