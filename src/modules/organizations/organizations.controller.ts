import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: any) {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations the user belongs to' })
  findAll(@CurrentUser() user: any) {
    return this.organizationsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization detail with members' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization (owner/admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: any) {
    return this.organizationsService.update(id, user.id, dto);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to the organization' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @CurrentUser() user: any) {
    return this.organizationsService.addMember(id, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from the organization' })
  removeMember(@Param('id') id: string, @Param('userId') targetUserId: string, @CurrentUser() user: any) {
    return this.organizationsService.removeMember(id, targetUserId, user.id);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Update member role (owner only)' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.organizationsService.updateMemberRole(id, targetUserId, dto, user.id);
  }
}
