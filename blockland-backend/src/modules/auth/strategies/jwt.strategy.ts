import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }    from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { User }             from '../../../database/entities/user.entity';
import { UserRole }         from '../../../database/entities/user-role.entity';

export interface JwtPayload {
  sub:   string;   // user UUID
  email: string;
  roles: string[];
  iat?:  number;
  exp?:  number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      configService.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where:    { id: payload.sub, isActive: true },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new UnauthorizedException('User not found or deactivated.');

    const roles = user.userRoles.map((ur) => ur.role.name);
    return { id: user.id, email: user.email, roles, walletAddress: user.walletAddress };
  }
}
