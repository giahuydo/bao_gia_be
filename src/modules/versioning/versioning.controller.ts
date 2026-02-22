import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VersioningService } from './versioning.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateVersionDto } from './dto/create-version.dto';
import { CompareVersionsQueryDto } from './dto/compare-versions-query.dto';

@ApiTags('versioning')
@ApiBearerAuth()
@Controller('quotations/:id/versions')
@UseGuards(JwtAuthGuard)
export class VersioningController {
  constructor(private readonly versioningService: VersioningService) {}

  @Get()
  @ApiOperation({ summary: 'List all versions of a quotation' })
  findAll(@Param('id') quotationId: string, @CurrentUser() user: any) {
    return this.versioningService.findAllVersions(quotationId, user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a version snapshot' })
  create(@Param('id') quotationId: string, @Body() dto: CreateVersionDto, @CurrentUser() user: any) {
    return this.versioningService.createSnapshot(
      quotationId,
      user.id,
      user.organizationId,
      dto.label,
      dto.changeSummary,
    );
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare two versions of a quotation' })
  compare(@Param('id') quotationId: string, @Query() query: CompareVersionsQueryDto, @CurrentUser() user: any) {
    return this.versioningService.compareVersions(quotationId, query.versionA, query.versionB, user.organizationId);
  }

  @Get(':versionId')
  @ApiOperation({ summary: 'Get a specific version snapshot' })
  findOne(@Param('id') quotationId: string, @Param('versionId') versionId: string, @CurrentUser() user: any) {
    return this.versioningService.findOneVersion(quotationId, versionId, user.organizationId);
  }
}
