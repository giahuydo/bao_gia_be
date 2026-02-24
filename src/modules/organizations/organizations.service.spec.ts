import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization, OrganizationPlan } from '../../database/entities/organization.entity';
import { OrganizationMember, OrgMemberRole } from '../../database/entities/organization-member.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const MEMBER_USER_ID = 'user-uuid-3';

const makeOrg = (overrides: Partial<Organization> = {}): Organization =>
  ({
    id: ORG_ID,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'A test org',
    logoUrl: null,
    isActive: true,
    plan: OrganizationPlan.FREE,
    monthlyTokenLimit: 100000,
    anthropicApiKey: null,
    members: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Organization);

const makeMember = (
  overrides: Partial<OrganizationMember> = {},
): OrganizationMember =>
  ({
    id: 'member-uuid-1',
    userId: USER_ID,
    organizationId: ORG_ID,
    role: OrgMemberRole.OWNER,
    isActive: true,
    organization: makeOrg(),
    user: { id: USER_ID, email: 'owner@test.com' } as any,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as OrganizationMember);

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let mockOrgRepo: Record<string, jest.Mock>;
  let mockMemberRepo: Record<string, jest.Mock>;
  let mockEncryptionService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      create: jest.fn((data) => ({ id: ORG_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    mockMemberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'member-uuid-new', ...entity })),
      count: jest.fn(),
    };

    mockEncryptionService = {
      encrypt: jest.fn((val: string) => `encrypted:${val}`),
      decrypt: jest.fn((val: string) => val.replace('encrypted:', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: getRepositoryToken(Organization), useValue: mockOrgRepo },
        { provide: getRepositoryToken(OrganizationMember), useValue: mockMemberRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto: CreateOrganizationDto = { name: 'Test Organization' };

    it('should generate slug from org name', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      const savedOrg = makeOrg();
      mockOrgRepo.save.mockResolvedValue(savedOrg);

      await service.create(USER_ID, dto);

      expect(mockOrgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'test-organization' }),
      );
    });

    it('should throw ConflictException when org name already exists', async () => {
      mockOrgRepo.findOne.mockResolvedValue(makeOrg());

      await expect(service.create(USER_ID, dto)).rejects.toThrow(ConflictException);
      await expect(service.create(USER_ID, dto)).rejects.toThrow('Organization name already exists');
    });

    it('should auto-add creator as OWNER member', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      const savedOrg = makeOrg();
      mockOrgRepo.save.mockResolvedValue(savedOrg);

      await service.create(USER_ID, dto);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          role: OrgMemberRole.OWNER,
          isActive: true,
        }),
      );
    });

    it('should encrypt anthropicApiKey when provided', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.save.mockResolvedValue(makeOrg());

      const dtoWithKey: CreateOrganizationDto = {
        name: 'Test Organization',
        anthropicApiKey: 'sk-ant-real-api-key',
      };
      await service.create(USER_ID, dtoWithKey);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('sk-ant-real-api-key');
      expect(mockOrgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ anthropicApiKey: 'encrypted:sk-ant-real-api-key' }),
      );
    });

    it('should not call encrypt when anthropicApiKey is not provided', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.save.mockResolvedValue(makeOrg());

      await service.create(USER_ID, dto);

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should return the saved organization', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      const savedOrg = makeOrg();
      mockOrgRepo.save.mockResolvedValue(savedOrg);

      const result = await service.create(USER_ID, dto);

      expect(result).toEqual(savedOrg);
    });

    it('should generate slug with special characters stripped', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.save.mockResolvedValue(makeOrg());

      const specialDto: CreateOrganizationDto = { name: 'Test & Org! (2024)' };
      await service.create(USER_ID, specialDto);

      expect(mockOrgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'test-org-2024' }),
      );
    });

    it('should generate slug with multiple spaces collapsed to single dash', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.save.mockResolvedValue(makeOrg());

      const spacedDto: CreateOrganizationDto = { name: 'My  Org  Name' };
      await service.create(USER_ID, spacedDto);

      expect(mockOrgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'my-org-name' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return organizations where user is an active member', async () => {
      const memberships = [
        makeMember({ role: OrgMemberRole.OWNER }),
        makeMember({
          id: 'member-uuid-2',
          userId: USER_ID,
          organizationId: 'org-uuid-2',
          role: OrgMemberRole.ADMIN,
          organization: makeOrg({ id: 'org-uuid-2', name: 'Org Two', slug: 'org-two' }),
        }),
      ];
      mockMemberRepo.find.mockResolvedValue(memberships);

      const result = await service.findAll(USER_ID);

      expect(mockMemberRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID, isActive: true },
        relations: ['organization'],
      });
      expect(result).toHaveLength(2);
    });

    it('should attach member role to each organization result', async () => {
      const memberships = [makeMember({ role: OrgMemberRole.MANAGER })];
      mockMemberRepo.find.mockResolvedValue(memberships);

      const result = await service.findAll(USER_ID);

      expect(result[0].role).toBe(OrgMemberRole.MANAGER);
    });

    it('should return empty array when user has no memberships', async () => {
      mockMemberRepo.find.mockResolvedValue([]);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return org with members and currentUserRole', async () => {
      const member = makeMember({ role: OrgMemberRole.OWNER });
      mockMemberRepo.findOne.mockResolvedValue(member);
      mockMemberRepo.find.mockResolvedValue([member]);

      const result = await service.findOne(ORG_ID, USER_ID);

      expect(result.currentUserRole).toBe(OrgMemberRole.OWNER);
      expect(result.members).toEqual([member]);
    });

    it('should throw NotFoundException when user is not a member', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ORG_ID, USER_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(ORG_ID, USER_ID)).rejects.toThrow(
        'Organization not found or no access',
      );
    });

    it('should mask the anthropicApiKey when present', async () => {
      const orgWithKey = makeOrg({ anthropicApiKey: 'encrypted:sk-ant-real-key-1234' });
      const member = makeMember({ organization: orgWithKey });
      mockMemberRepo.findOne.mockResolvedValue(member);
      mockMemberRepo.find.mockResolvedValue([member]);
      mockEncryptionService.decrypt.mockReturnValue('sk-ant-real-key-1234');

      const result = await service.findOne(ORG_ID, USER_ID);

      expect((result as any).anthropicApiKeyMasked).toBeDefined();
      expect((result as any).anthropicApiKeyMasked).toContain('...');
      expect((result as any).anthropicApiKey).toBeUndefined();
    });

    it('should set anthropicApiKeyMasked to "***encrypted***" when decrypt fails', async () => {
      const orgWithKey = makeOrg({ anthropicApiKey: 'bad-encrypted-value' });
      const member = makeMember({ organization: orgWithKey });
      mockMemberRepo.findOne.mockResolvedValue(member);
      mockMemberRepo.find.mockResolvedValue([member]);
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await service.findOne(ORG_ID, USER_ID);

      expect((result as any).anthropicApiKeyMasked).toBe('***encrypted***');
    });

    it('should not attempt to decrypt when anthropicApiKey is null', async () => {
      const member = makeMember({ organization: makeOrg({ anthropicApiKey: null as any }) });
      mockMemberRepo.findOne.mockResolvedValue(member);
      mockMemberRepo.find.mockResolvedValue([member]);

      await service.findOne(ORG_ID, USER_ID);

      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update organization name and regenerate slug', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.OWNER }));
      const existingOrg = makeOrg();
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockResolvedValue({ ...existingOrg, name: 'New Name', slug: 'new-name' });

      const dto: UpdateOrganizationDto = { name: 'New Name' };
      const result = await service.update(ORG_ID, USER_ID, dto);

      expect(result.slug).toBe('new-name');
      expect(result.name).toBe('New Name');
    });

    it('should throw ForbiddenException for non-admin/owner members', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.MEMBER }));

      const dto: UpdateOrganizationDto = { name: 'New Name' };
      await expect(service.update(ORG_ID, USER_ID, dto)).rejects.toThrow(ForbiddenException);
      await expect(service.update(ORG_ID, USER_ID, dto)).rejects.toThrow(
        'Only owners and admins can perform this action',
      );
    });

    it('should throw ForbiddenException when user is not a member at all', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);

      const dto: UpdateOrganizationDto = { name: 'New Name' };
      await expect(service.update(ORG_ID, USER_ID, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.OWNER }));
      mockOrgRepo.findOne.mockResolvedValue(null);

      const dto: UpdateOrganizationDto = { name: 'New Name' };
      await expect(service.update(ORG_ID, USER_ID, dto)).rejects.toThrow(NotFoundException);
      await expect(service.update(ORG_ID, USER_ID, dto)).rejects.toThrow('Organization not found');
    });

    it('should encrypt anthropicApiKey during update', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.ADMIN }));
      const existingOrg = makeOrg();
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockResolvedValue(existingOrg);

      const dto: UpdateOrganizationDto = { anthropicApiKey: 'new-api-key' };
      await service.update(ORG_ID, USER_ID, dto);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('new-api-key');
    });

    it('should allow ADMIN role to update', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.ADMIN }));
      const existingOrg = makeOrg();
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockResolvedValue(existingOrg);

      const dto: UpdateOrganizationDto = { description: 'Updated description' };
      await expect(service.update(ORG_ID, USER_ID, dto)).resolves.not.toThrow();
    });

    it('should not regenerate slug when name is not in update dto', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.OWNER }));
      const existingOrg = makeOrg({ slug: 'original-slug' });
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: UpdateOrganizationDto = { description: 'Updated desc' };
      const result = await service.update(ORG_ID, USER_ID, dto);

      expect(result.slug).toBe('original-slug');
    });
  });

  // ---------------------------------------------------------------------------
  // addMember()
  // ---------------------------------------------------------------------------
  describe('addMember', () => {
    const addDto: AddMemberDto = { userId: MEMBER_USER_ID, role: OrgMemberRole.MEMBER };

    it('should add a new member to organization', async () => {
      // First call: caller's membership check; second call: check if target already member
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(null);

      await service.addMember(ORG_ID, addDto, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: MEMBER_USER_ID,
          organizationId: ORG_ID,
          role: OrgMemberRole.MEMBER,
          isActive: true,
        }),
      );
    });

    it('should throw ForbiddenException when caller is not owner/admin', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.MEMBER }));

      await expect(service.addMember(ORG_ID, addDto, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when user is already an active member', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(makeMember({ userId: MEMBER_USER_ID, isActive: true }));

      await expect(service.addMember(ORG_ID, addDto, USER_ID)).rejects.toThrow(ConflictException);
      await expect(
        service.addMember(ORG_ID, addDto, USER_ID),
      ).rejects.toThrow('User is already a member');
    });

    it('should reactivate an inactive member instead of creating a new one', async () => {
      const inactiveMember = makeMember({ userId: MEMBER_USER_ID, isActive: false });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(inactiveMember);

      await service.addMember(ORG_ID, addDto, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should default role to MEMBER when no role specified', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(null);

      const dtoNoRole: AddMemberDto = { userId: MEMBER_USER_ID };
      await service.addMember(ORG_ID, dtoNoRole, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: OrgMemberRole.MEMBER }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember()
  // ---------------------------------------------------------------------------
  describe('removeMember', () => {
    it('should soft-deactivate member (isActive = false)', async () => {
      const targetMember = makeMember({
        id: 'member-target',
        userId: OTHER_USER_ID,
        role: OrgMemberRole.MEMBER,
      });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER })) // caller role
        .mockResolvedValueOnce(targetMember); // target member

      await service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw BadRequestException when trying to remove yourself', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.OWNER }));

      await expect(service.removeMember(ORG_ID, USER_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeMember(ORG_ID, USER_ID, USER_ID)).rejects.toThrow(
        'Cannot remove yourself',
      );
    });

    it('should throw ForbiddenException when caller is not owner/admin', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.MEMBER }));

      await expect(service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when target member not found', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(null);

      await expect(service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID)).rejects.toThrow(
        'Member not found',
      );
    });

    it('should throw BadRequestException when trying to remove the last owner', async () => {
      const ownerMember = makeMember({ userId: OTHER_USER_ID, role: OrgMemberRole.OWNER });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(ownerMember);
      mockMemberRepo.count.mockResolvedValue(1); // only 1 owner

      await expect(service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID)).rejects.toThrow(
        'Cannot remove the last owner',
      );
    });

    it('should allow removing an owner when there are multiple owners', async () => {
      const ownerMember = makeMember({ userId: OTHER_USER_ID, role: OrgMemberRole.OWNER });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(ownerMember);
      mockMemberRepo.count.mockResolvedValue(2); // 2 owners, safe to remove one

      await expect(service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID)).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // updateMemberRole()
  // ---------------------------------------------------------------------------
  describe('updateMemberRole', () => {
    const updateRoleDto: UpdateMemberRoleDto = { role: OrgMemberRole.ADMIN };

    it('should update member role', async () => {
      const targetMember = makeMember({ userId: OTHER_USER_ID, role: OrgMemberRole.MEMBER });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(targetMember);

      await service.updateMemberRole(ORG_ID, OTHER_USER_ID, updateRoleDto, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: OrgMemberRole.ADMIN }),
      );
    });

    it('should throw ForbiddenException when caller is not OWNER (admin cannot change roles)', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.ADMIN }));

      await expect(
        service.updateMemberRole(ORG_ID, OTHER_USER_ID, updateRoleDto, USER_ID),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateMemberRole(ORG_ID, OTHER_USER_ID, updateRoleDto, USER_ID),
      ).rejects.toThrow('Only owners can change member roles');
    });

    it('should throw ForbiddenException when caller has MANAGER role', async () => {
      mockMemberRepo.findOne.mockResolvedValue(makeMember({ role: OrgMemberRole.MANAGER }));

      await expect(
        service.updateMemberRole(ORG_ID, OTHER_USER_ID, updateRoleDto, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target member not found', async () => {
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(null);

      await expect(
        service.updateMemberRole(ORG_ID, OTHER_USER_ID, updateRoleDto, USER_ID),
      ).rejects.toThrow('Member not found');
    });

    it('should allow promoting MEMBER to OWNER', async () => {
      const targetMember = makeMember({ userId: OTHER_USER_ID, role: OrgMemberRole.MEMBER });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(makeMember({ role: OrgMemberRole.OWNER }))
        .mockResolvedValueOnce(targetMember);

      const promoteToOwnerDto: UpdateMemberRoleDto = { role: OrgMemberRole.OWNER };
      await service.updateMemberRole(ORG_ID, OTHER_USER_ID, promoteToOwnerDto, USER_ID);

      expect(mockMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: OrgMemberRole.OWNER }),
      );
    });
  });
});
