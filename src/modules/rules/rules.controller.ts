import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRuleSetDto } from './dto/create-rule-set.dto';
import { UpdateRuleSetDto } from './dto/update-rule-set.dto';
import { EvaluateRulesDto } from './dto/evaluate-rules.dto';
import { RuleCategory } from '../../database/entities/rule-set.entity';

@ApiTags('rules')
@ApiBearerAuth()
@Controller('rules')
@UseGuards(JwtAuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a rule set' })
  create(@Body() dto: CreateRuleSetDto, @CurrentUser() user: any) {
    return this.rulesService.create(user.organizationId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List rule sets' })
  findAll(@CurrentUser() user: any, @Query('category') category?: RuleCategory) {
    return this.rulesService.findAll(user.organizationId, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rule set detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rulesService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule set' })
  update(@Param('id') id: string, @Body() dto: UpdateRuleSetDto, @CurrentUser() user: any) {
    return this.rulesService.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rule set' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rulesService.remove(id, user.organizationId);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate rules against sample data' })
  evaluate(@Body() dto: EvaluateRulesDto, @CurrentUser() user: any) {
    return this.rulesService.evaluate(user.organizationId, dto.category, dto.items, dto.ruleSetId);
  }
}
