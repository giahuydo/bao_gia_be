import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { OrganizationMember, OrgMemberRole } from '../../database/entities/organization-member.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const USER_ID = 'user-uuid-1';
const ORG_ID = 'org-uuid-1';
const MEMBER_ID = 'member-uuid-1';
const HASHED_PASSWORD = '$2b$10$hashedpasswordexample';
const JWT_TOKEN = 'signed.jwt.token';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: USER_ID,
  email: 'user@example.com',
  password: HASHED_PASSWORD,
  fullName: 'Nguyen Van A',
  role: UserRole.SALES,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  customers: [],
  products: [],
  quotations: [],
  templates: [],
  ...overrides,
} as User);

const makeOrgMember = (overrides: Partial<OrganizationMember> = {}): OrganizationMember => ({
  id: MEMBER_ID,
  userId: USER_ID,
  organizationId: ORG_ID,
  role: OrgMemberRole.MEMBER,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  user: null,
  organization: null,
  ...overrides,
} as OrganizationMember);

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: Record<string, jest.Mock>;
  let mockOrgMemberRepo: Record<string, jest.Mock>;
  let mockJwtService: { sign: jest.Mock };

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: USER_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    mockOrgMemberRepo = {
      findOne: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue(JWT_TOKEN),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(OrganizationMember), useValue: mockOrgMemberRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------
  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password123',
      fullName: 'New User',
    };

    it('should hash the password before saving', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const hashSpy = jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email, fullName: registerDto.fullName });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.register(registerDto);

      expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 10);
    });

    it('should create and save user with hashed password', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email, fullName: registerDto.fullName });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.register(registerDto);

      expect(mockUserRepo.create).toHaveBeenCalledWith({
        ...registerDto,
        password: HASHED_PASSWORD,
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should return accessToken and user without password', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email, fullName: registerDto.fullName });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe(JWT_TOKEN);
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
    });

    it('should include organizationId in token when user has an active membership', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email, fullName: registerDto.fullName });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(makeOrgMember());

      await service.register(registerDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    });

    it('should generate token without organizationId when user has no membership', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.register(registerDto);

      const signArg = mockJwtService.sign.mock.calls[0][0] as Record<string, any>;
      expect(signArg).not.toHaveProperty('organizationId');
    });

    it('should include sub, email, and role in the JWT payload', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.register(registerDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: USER_ID,
          email: savedUser.email,
          role: savedUser.role,
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email already exists');
    });

    it('should not call save when email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);

      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('should check for existing user by the provided email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(HASHED_PASSWORD as never);

      const savedUser = makeUser({ email: registerDto.email });
      mockUserRepo.save.mockResolvedValue(savedUser);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.register(registerDto);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------
  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'user@example.com',
      password: 'plainpassword',
    };

    it('should return accessToken and user without password on valid credentials', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe(JWT_TOKEN);
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
    });

    it('should look up user by the provided email', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login(loginDto);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
    });

    it('should compare plaintext password against stored hash', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login(loginDto);

      expect(compareSpy).toHaveBeenCalledWith(loginDto.password, user.password);
    });

    it('should include organizationId in token when user has an active membership', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(makeOrgMember());

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    });

    it('should throw UnauthorizedException when email does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when account is deactivated', async () => {
      const inactiveUser = makeUser({ isActive: false });
      mockUserRepo.findOne.mockResolvedValue(inactiveUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Account is deactivated');
    });

    it('should not call bcrypt.compare when user is not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const compareSpy = jest.spyOn(bcrypt, 'compare');

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      expect(compareSpy).not.toHaveBeenCalled();
    });

    it('should not check isActive when password is wrong', async () => {
      const inactiveUser = makeUser({ isActive: false });
      mockUserRepo.findOne.mockResolvedValue(inactiveUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      // Password check fails first -- the error message should be 'Invalid credentials', not 'Account is deactivated'
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should include sub, email, and role in the JWT payload', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: user.id,
          email: user.email,
          role: user.role,
        }),
      );
    });

    it('should return the correct user data excluding password', async () => {
      const user = makeUser({ fullName: 'Tran Thi B', role: UserRole.MANAGER });
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      const result = await service.login(loginDto);

      expect(result.user.id).toBe(USER_ID);
      expect(result.user.fullName).toBe('Tran Thi B');
      expect(result.user.role).toBe(UserRole.MANAGER);
      expect((result.user as any).password).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // generateToken() -- tested indirectly via register() and login()
  // -------------------------------------------------------------------------
  describe('generateToken (via login)', () => {
    it('should look up org membership by userId with isActive = true', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login({ email: user.email, password: 'plainpassword' });

      expect(mockOrgMemberRepo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, isActive: true },
      });
    });

    it('should omit organizationId from payload when no active membership exists', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login({ email: user.email, password: 'plainpassword' });

      const signArg = mockJwtService.sign.mock.calls[0][0] as Record<string, any>;
      expect(signArg.organizationId).toBeUndefined();
    });

    it('should include organizationId in payload when active membership is found', async () => {
      const user = makeUser();
      const member = makeOrgMember({ organizationId: 'another-org-id' });
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(member);

      await service.login({ email: user.email, password: 'plainpassword' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'another-org-id' }),
      );
    });

    it('should call jwtService.sign exactly once per operation', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await service.login({ email: user.email, password: 'plainpassword' });

      expect(mockJwtService.sign).toHaveBeenCalledTimes(1);
    });
  });
});
