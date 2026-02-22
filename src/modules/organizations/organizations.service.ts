import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';
import { OrganizationMember, OrgMemberRole } from '../../database/entities/organization-member.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
    private encryptionService: EncryptionService,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async getMemberRole(userId: string, orgId: string): Promise<OrgMemberRole | null> {
    const member = await this.memberRepository.findOne({
      where: { userId, organizationId: orgId, isActive: true },
    });
    return member?.role || null;
  }

  private assertAdminOrOwner(role: OrgMemberRole | null) {
    if (!role || ![OrgMemberRole.OWNER, OrgMemberRole.ADMIN].includes(role)) {
      throw new ForbiddenException('Only owners and admins can perform this action');
    }
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = this.generateSlug(dto.name);
    const existing = await this.orgRepository.findOne({ where: [{ name: dto.name }, { slug }] });
    if (existing) {
      throw new ConflictException('Organization name already exists');
    }

    const org = this.orgRepository.create({
      ...dto,
      slug,
      anthropicApiKey: dto.anthropicApiKey
        ? this.encryptionService.encrypt(dto.anthropicApiKey)
        : undefined,
    });
    const saved = await this.orgRepository.save(org);

    // Auto-add creator as owner
    await this.memberRepository.save({
      userId,
      organizationId: saved.id,
      role: OrgMemberRole.OWNER,
      isActive: true,
    });

    return saved;
  }

  async findAll(userId: string) {
    const memberships = await this.memberRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
    });
    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  async findOne(id: string, userId: string) {
    const member = await this.memberRepository.findOne({
      where: { userId, organizationId: id, isActive: true },
      relations: ['organization'],
    });
    if (!member) {
      throw new NotFoundException('Organization not found or no access');
    }
    const org = member.organization;
    // Decrypt API key for display (masked)
    if (org.anthropicApiKey) {
      try {
        const decrypted = this.encryptionService.decrypt(org.anthropicApiKey);
        (org as any).anthropicApiKeyMasked = decrypted.slice(0, 8) + '...' + decrypted.slice(-4);
      } catch {
        (org as any).anthropicApiKeyMasked = '***encrypted***';
      }
      delete (org as any).anthropicApiKey;
    }

    // Load members
    const members = await this.memberRepository.find({
      where: { organizationId: id, isActive: true },
      relations: ['user'],
    });

    return { ...org, members, currentUserRole: member.role };
  }

  async update(id: string, userId: string, dto: UpdateOrganizationDto) {
    const role = await this.getMemberRole(userId, id);
    this.assertAdminOrOwner(role);

    const org = await this.orgRepository.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.name) {
      org.slug = this.generateSlug(dto.name);
    }
    if (dto.anthropicApiKey) {
      dto.anthropicApiKey = this.encryptionService.encrypt(dto.anthropicApiKey);
    }

    Object.assign(org, dto);
    return this.orgRepository.save(org);
  }

  async addMember(orgId: string, dto: AddMemberDto, userId: string) {
    const role = await this.getMemberRole(userId, orgId);
    this.assertAdminOrOwner(role);

    const existing = await this.memberRepository.findOne({
      where: { userId: dto.userId, organizationId: orgId },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('User is already a member');
      existing.isActive = true;
      existing.role = dto.role || OrgMemberRole.MEMBER;
      return this.memberRepository.save(existing);
    }

    return this.memberRepository.save({
      userId: dto.userId,
      organizationId: orgId,
      role: dto.role || OrgMemberRole.MEMBER,
      isActive: true,
    });
  }

  async removeMember(orgId: string, targetUserId: string, userId: string) {
    const role = await this.getMemberRole(userId, orgId);
    this.assertAdminOrOwner(role);

    if (targetUserId === userId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    const member = await this.memberRepository.findOne({
      where: { userId: targetUserId, organizationId: orgId, isActive: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Can't remove last owner
    if (member.role === OrgMemberRole.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: { organizationId: orgId, role: OrgMemberRole.OWNER, isActive: true },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    member.isActive = false;
    return this.memberRepository.save(member);
  }

  async updateMemberRole(orgId: string, targetUserId: string, dto: UpdateMemberRoleDto, userId: string) {
    const role = await this.getMemberRole(userId, orgId);
    if (role !== OrgMemberRole.OWNER) {
      throw new ForbiddenException('Only owners can change member roles');
    }

    const member = await this.memberRepository.findOne({
      where: { userId: targetUserId, organizationId: orgId, isActive: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    member.role = dto.role;
    return this.memberRepository.save(member);
  }
}
