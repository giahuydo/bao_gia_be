import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { OrganizationMember } from '../../../database/entities/organization-member.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganizationMember)
    private orgMemberRepository: Repository<OrganizationMember>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    });
  }

  async validate(payload: { sub: string; email: string; organizationId?: string }) {
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Load user's organization memberships
    const memberships = await this.orgMemberRepository.find({
      where: { userId: user.id, isActive: true },
    });
    const organizationIds = memberships.map((m) => m.organizationId);

    // Default org: from JWT payload, or first membership
    const organizationId = payload.organizationId || organizationIds[0] || null;

    return {
      ...user,
      organizationId,
      organizationIds,
    };
  }
}
