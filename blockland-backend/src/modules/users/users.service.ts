import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }  from 'typeorm';
import * as bcrypt     from 'bcrypt';
import { User }        from '../../database/entities/user.entity';
import { JwtPayload }  from '../auth/strategies/jwt.strategy';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({
      where:     { id: userId },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('User not found.');
    return {
      id:            user.id,
      fullName:      user.fullName,
      email:         user.email,
      phone:         user.phone,
      nationalId:    user.nationalId,
      walletAddress: user.walletAddress,
      blocklandId:   user.blocklandId,
      isActive:      user.isActive,
      isApproved:    user.isApproved,
      roles:         user.userRoles?.map((ur) => ur.role?.name) ?? [],
    };
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (data.fullName) user.fullName = data.fullName;
    if (data.phone)    user.phone    = data.phone;
    await this.userRepo.save(user);
    return this.getMe(userId);
  }

  async linkWallet(userId: string, walletAddress: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    user.walletAddress = walletAddress;
    await this.userRepo.save(user);
    return { message: 'Wallet linked successfully.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new ForbiddenException('Current password is incorrect.');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Password changed successfully.' };
  }

  /** Search for a buyer by Blockland ID — returns only non-PII fields. */
  async searchByBlocklandId(blocklandId: string) {
    const user = await this.userRepo.findOne({
      where:     { blocklandId: blocklandId.toUpperCase(), isActive: true, isApproved: true },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) return null;
    return {
      id:          user.id,
      fullName:    user.fullName,
      blocklandId: user.blocklandId,
      roles:       user.userRoles?.map((ur) => ur.role?.name) ?? [],
    };
  }

  async list(params: { page?: number; limit?: number; search?: string }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoinAndSelect('u.userRoles', 'ur')
      .leftJoinAndSelect('ur.role', 'r')
      .orderBy('u.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.where('u.full_name ILIKE :s OR u.email ILIKE :s', { s: `%${params.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((u) => ({
        id: u.id, fullName: u.fullName, email: u.email,
        blocklandId: u.blocklandId, isActive: u.isActive, isApproved: u.isApproved,
        roles: u.userRoles?.map((ur) => ur.role?.name) ?? [],
      })),
      total, page, limit,
    };
  }
}
