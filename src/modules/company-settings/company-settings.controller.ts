import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('company-settings')
@ApiBearerAuth()
@Controller('company-settings')
@UseGuards(JwtAuthGuard)
export class CompanySettingsController {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get company settings' })
  get(@CurrentUser() user: any) {
    return this.companySettingsService.get(user.organizationId);
  }

  @Put()
  @ApiOperation({ summary: 'Update company settings' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Body() dto: UpdateCompanySettingsDto, @CurrentUser() user: any) {
    return this.companySettingsService.update(dto, user.organizationId);
  }
}
