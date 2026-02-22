import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsEnum } from 'class-validator';
import { OrgMemberRole } from '../../../database/entities/organization-member.entity';

export class AddMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: OrgMemberRole, default: OrgMemberRole.MEMBER })
  @IsOptional()
  @IsEnum(OrgMemberRole)
  role?: OrgMemberRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: OrgMemberRole })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole;
}
