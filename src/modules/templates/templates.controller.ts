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
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a template' })
  create(@Body() createDto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.templatesService.create(createDto, user.id, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List all templates' })
  findAll(@CurrentUser() user: any) {
    return this.templatesService.findAll(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.templatesService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  update(@Param('id') id: string, @Body() updateDto: UpdateTemplateDto, @CurrentUser() user: any) {
    return this.templatesService.update(id, updateDto, user.organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a template' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.templatesService.remove(id, user.organizationId);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply template to generate quotation draft data' })
  apply(@Param('id') id: string, @Body() applyDto: ApplyTemplateDto, @CurrentUser() user: any) {
    return this.templatesService.apply(id, applyDto, user.organizationId);
  }
}
