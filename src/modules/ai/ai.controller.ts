import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { TokenTrackingService } from './token-tracking.service';
import { GenerateQuotationDto } from './dto/generate-quotation.dto';
import { SuggestItemsDto } from './dto/suggest-items.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';
import { UsageSummaryQueryDto, UsageRecordsQueryDto } from './dto/usage-query.dto';
import { CompareSpecsDto } from './dto/compare-specs.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
  generateQuotation(@Body() dto: GenerateQuotationDto, @CurrentUser() user: any) {
    return this.aiService.generateQuotation(dto.description, {
      userId: user.id,
      quotationId: undefined,
    });
  }

  @Post('suggest-items')
  @ApiOperation({ summary: 'AI suggests items based on quotation title' })
  suggestItems(@Body() dto: SuggestItemsDto, @CurrentUser() user: any) {
    return this.aiService.suggestItems(dto.title, dto.existingItems, {
      userId: user.id,
    });
  }

  @Post('improve-description')
  @ApiOperation({ summary: 'AI improves an item description' })
  improveDescription(@Body() dto: ImproveDescriptionDto, @CurrentUser() user: any) {
    return this.aiService.improveDescription(dto.itemName, dto.currentDescription, {
      userId: user.id,
    });
  }

  @Post('compare')
  @ApiOperation({ summary: 'AI compares vendor spec against customer requirements' })
  compare(@Body() dto: CompareSpecsDto, @CurrentUser() user: any) {
    return this.aiService.compare(dto.vendorSpec, dto.customerRequirement, {
      userId: user.id,
      quotationId: dto.quotationId,
      organizationId: user.organizationId,
    });
  }

  @Get('usage/summary')
  @ApiOperation({ summary: 'Get aggregated AI token usage summary' })
  getUsageSummary(@Query() query: UsageSummaryQueryDto) {
    return this.tokenTrackingService.getUsageSummary(query);
  }

  @Get('usage/records')
  @ApiOperation({ summary: 'Get detailed per-request token usage records' })
  getUsageRecords(@Query() query: UsageRecordsQueryDto) {
    return this.tokenTrackingService.getUsageRecords(query);
  }

  @Get('usage/dashboard')
  @ApiOperation({ summary: 'Get cost analytics dashboard with time-series data' })
  getDashboard(@Query() query: DashboardQueryDto, @CurrentUser() user: any) {
    return this.aiService.getDashboard(user.organizationId, query);
  }
}
