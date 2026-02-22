import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { OrganizationMember } from '../../database/entities/organization-member.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(OrganizationMember)
    private orgMemberRepository: Repository<OrganizationMember>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existing = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
    });
    const savedUser = await this.usersRepository.save(user);
    const token = await this.generateToken(savedUser);

    const { password, ...result } = savedUser;
    return { user: result, accessToken: token };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const token = await this.generateToken(user);
    const { password, ...result } = user;
    return { user: result, accessToken: token };
  }

  private async generateToken(user: User): Promise<string> {
    // Find user's default organization (first active membership)
    const membership = await this.orgMemberRepository.findOne({
      where: { userId: user.id, isActive: true },
    });
    const payload: Record<string, any> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    if (membership) {
      payload.organizationId = membership.organizationId;
    }
    return this.jwtService.sign(payload);
  }
}
