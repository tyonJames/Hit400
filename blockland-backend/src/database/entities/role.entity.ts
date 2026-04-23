import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity }  from './base.entity';
import { UserRole as UserRoleEntity } from './user-role.entity';
import { UserRole }    from '../enums';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ name: 'name', type: 'enum', enum: UserRole, unique: true })
  name: UserRole;

  @Column({ name: 'description', type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @OneToMany(() => UserRoleEntity, (ur) => ur.role)
  userRoles: UserRoleEntity[];
}
