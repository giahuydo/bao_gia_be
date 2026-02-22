import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptType } from '../../database/entities/ai-prompt-version.entity';

@ApiTags('prompts')
@ApiBearerAuth()
@Controller('prompts')
@UseGuards(JwtAuthGuard)
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new prompt version' })
  create(@Body() dto: CreatePromptDto, @CurrentUser() user: any) {
    return this.promptsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List prompt versions' })
  findAll(@Query('type') type?: PromptType) {
    return this.promptsService.findAll(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prompt version detail' })
  findOne(@Param('id') id: string) {
    return this.promptsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft prompt version' })
  update(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    return this.promptsService.update(id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a prompt version (deactivates previous)' })
  activate(@Param('id') id: string) {
    return this.promptsService.activate(id);
  }
}
