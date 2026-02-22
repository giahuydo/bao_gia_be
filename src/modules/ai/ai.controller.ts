import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { TokenTrackingService } from './token-tracking.service';
import { GenerateQuotationDto } from './dto/generate-quotation.dto';
import { SuggestItemsDto } from './dto/suggest-items.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';
import { UsageSummaryQueryDto, UsageRecordsQueryDto } from './dto/usage-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly tokenTrackingService: TokenTrackingService,
  ) {}

  @Post('generate-quotation')
  @ApiOperation({ summary: 'AI generates a quotation draft from text description' })
  generateQuotation(@Body() dto: GenerateQuotationDto) {
    return this.aiService.generateQuotation(dto.description);
  }

  @Post('suggest-items')
  @ApiOperation({ summary: 'AI suggests items based on quotation title' })
  suggestItems(@Body() dto: SuggestItemsDto) {
    return this.aiService.suggestItems(dto.title, dto.existingItems);
  }

  @Post('improve-description')
  @ApiOperation({ summary: 'AI improves an item description' })
  improveDescription(@Body() dto: ImproveDescriptionDto) {
    return this.aiService.improveDescription(dto.itemName, dto.currentDescription);
  }

  @Get('usage/summary')
  @ApiOperation({
    summary: 'Get aggregated AI token usage summary',
    description: 'Returns total tokens, cost, and breakdowns by operation and model within a date range.',
  })
  getUsageSummary(@Query() query: UsageSummaryQueryDto) {
    return this.tokenTrackingService.getUsageSummary(query);
  }

  @Get('usage/records')
  @ApiOperation({
    summary: 'Get detailed per-request token usage records',
    description: 'Paginated list of individual AI API calls with token counts and costs.',
  })
  getUsageRecords(@Query() query: UsageRecordsQueryDto) {
    return this.tokenTrackingService.getUsageRecords(query);
  }
}
