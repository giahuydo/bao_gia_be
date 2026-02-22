import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GlossaryService } from './glossary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateGlossaryTermDto } from './dto/create-glossary-term.dto';
import { UpdateGlossaryTermDto } from './dto/update-glossary-term.dto';
import { ImportGlossaryDto, GlossaryQueryDto } from './dto/import-glossary.dto';

@ApiTags('glossary')
@ApiBearerAuth()
@Controller('glossary')
@UseGuards(JwtAuthGuard)
export class GlossaryController {
  constructor(private readonly glossaryService: GlossaryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a glossary term' })
  create(@Body() dto: CreateGlossaryTermDto, @CurrentUser() user: any) {
    return this.glossaryService.create(user.organizationId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List glossary terms' })
  findAll(@CurrentUser() user: any, @Query() query: GlossaryQueryDto) {
    return this.glossaryService.findAll(user.organizationId, query.category, query.search);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export glossary terms' })
  exportTerms(@CurrentUser() user: any, @Query('category') category?: string) {
    return this.glossaryService.exportTerms(user.organizationId, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get glossary term detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.glossaryService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a glossary term' })
  update(@Param('id') id: string, @Body() dto: UpdateGlossaryTermDto, @CurrentUser() user: any) {
    return this.glossaryService.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a glossary term' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.glossaryService.remove(id, user.organizationId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import glossary terms' })
  importTerms(@Body() dto: ImportGlossaryDto, @CurrentUser() user: any) {
    return this.glossaryService.importTerms(user.organizationId, dto, user.id);
  }
}
