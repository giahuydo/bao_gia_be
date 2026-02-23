import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PriceMonitoringService } from './price-monitoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TriggerMonitoringDto } from './dto/trigger-monitoring.dto';
import { PriceMonitoringQueryDto, PriceAlertQueryDto } from './dto/price-monitoring-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';

@ApiTags('price-monitoring')
@ApiBearerAuth()
@Controller('price-monitoring')
@UseGuards(JwtAuthGuard)
export class PriceMonitoringController {
  constructor(private readonly priceMonitoringService: PriceMonitoringService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger a price monitoring job for the organization' })
  @ApiResponse({ status: 201, description: 'Price monitoring job created and triggered' })
  triggerMonitoring(@Body() dto: TriggerMonitoringDto, @CurrentUser() user: any) {
    return this.priceMonitoringService.triggerMonitoring(dto, user.id, user.organizationId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List price monitoring jobs for the organization' })
  @ApiResponse({ status: 200, description: 'Paginated list of price monitoring jobs' })
  findAllJobs(@Query() query: PriceMonitoringQueryDto, @CurrentUser() user: any) {
    return this.priceMonitoringService.findAllJobs(query, user.organizationId);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a price monitoring job with its price records' })
  @ApiResponse({ status: 200, description: 'Price monitoring job details with records' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  findJobById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.priceMonitoringService.findJobById(id, user.organizationId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get price history for a specific product' })
  @ApiResponse({ status: 200, description: 'Paginated price history records' })
  getPriceHistory(@Query() query: PriceHistoryQueryDto, @CurrentUser() user: any) {
    return this.priceMonitoringService.getPriceHistory(query, user.organizationId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List price alerts for the organization' })
  @ApiResponse({ status: 200, description: 'Paginated list of price alerts' })
  findAlerts(@Query() query: PriceAlertQueryDto, @CurrentUser() user: any) {
    return this.priceMonitoringService.findAlerts(query, user.organizationId);
  }

  @Patch('alerts/read-all')
  @ApiOperation({ summary: 'Mark all price alerts as read for the organization' })
  @ApiResponse({ status: 200, description: 'All alerts marked as read' })
  markAllAlertsRead(@CurrentUser() user: any) {
    return this.priceMonitoringService.markAllAlertsRead(user.organizationId);
  }

  @Patch('alerts/:id/read')
  @ApiOperation({ summary: 'Mark a specific price alert as read' })
  @ApiResponse({ status: 200, description: 'Alert marked as read' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  markAlertRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.priceMonitoringService.markAlertRead(id, user.organizationId);
  }
}
