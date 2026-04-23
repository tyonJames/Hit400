import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { User }     from '../../database/entities/user.entity';
import { Role }     from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { UserRole as UserRoleEnum } from '../../database/enums';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)        private userRepo: Repository<User>,
    @InjectRepository(Role)        private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(ActivityLog) private logRepo: Repository<ActivityLog>,
  ) {}

  async getRegistrars() {
    const role = await this.roleRepo.findOne({ where: { name: UserRoleEnum.REGISTRAR } });
    if (!role) return [];
    const userRoles = await this.userRoleRepo.find({
      where: { roleId: role.id },
      relations: ['user'],
    });
    return userRoles.map((ur) => ur.user);
  }

  async addRegistrar(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const role = await this.roleRepo.findOne({ where: { name: UserRoleEnum.REGISTRAR } });
    const existing = await this.userRoleRepo.findOne({ where: { userId, roleId: role.id } });
    if (existing) throw new ConflictException('User is already a registrar.');
    await this.userRoleRepo.save({ userId, roleId: role.id });
    return { message: 'Registrar role assigned.' };
  }

  async removeRegistrar(userId: string) {
    const role = await this.roleRepo.findOne({ where: { name: UserRoleEnum.REGISTRAR } });
    await this.userRoleRepo.delete({ userId, roleId: role.id });
    return { message: 'Registrar role removed.' };
  }

  async getLogs(params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.logRepo.findAndCount({
      order:     { performedAt: 'DESC' },
      skip:      (page - 1) * limit,
      take:      limit,
      relations: ['user'],
    });
    return { data, total, page, limit };
  }

  async getStats() {
    const [totalUsers, totalProperties, totalTransfers] = await Promise.all([
      this.userRepo.count(),
      this.logRepo.count({ where: { entityType: 'Property' } }),
      this.logRepo.count({ where: { entityType: 'Transfer' } }),
    ]);
    return { totalUsers, totalProperties, totalTransfers };
  }

  async listUsers(params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
      relations: ['userRoles', 'userRoles.role'],
    });
    return { data, total, page, limit };
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    user.isActive = isActive;
    await this.userRepo.save(user);
    return { message: `User ${isActive ? 'activated' : 'deactivated'}.` };
  }

  async getPendingUsers() {
    return this.userRepo.find({
      where: { isApproved: false },
      order: { createdAt: 'ASC' },
      select: ['id', 'fullName', 'nationalId', 'email', 'phone', 'createdAt'],
    });
  }

  async approveUser(userId: string, roles: UserRoleEnum[], adminId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.isApproved) throw new BadRequestException('User is already approved.');
    if (!roles || roles.length === 0) throw new BadRequestException('At least one role must be assigned.');

    // Remove any existing roles (e.g. the default PUBLIC assigned at registration)
    await this.userRoleRepo.delete({ userId });

    // Assign the chosen roles
    for (const roleName of roles) {
      const role = await this.roleRepo.findOne({ where: { name: roleName } });
      if (role) await this.userRoleRepo.save({ userId, roleId: role.id });
    }

    user.isApproved   = true;
    user.approvedAt   = new Date();
    user.approvedById = adminId;
    await this.userRepo.save(user);

    return { message: 'User approved successfully.', userId };
  }
}
