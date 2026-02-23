import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { QuotationProcessedDto } from './dto/quotation-processed.dto';
import { DeliveryCompletedDto } from './dto/delivery-completed.dto';
import { ExecutionFailedDto } from './dto/execution-failed.dto';
import { PriceMonitoringCallbackDto } from '../price-monitoring/dto/price-monitoring-callback.dto';
import { PriceMonitoringService } from '../price-monitoring/price-monitoring.service';

@ApiTags('webhooks')
@ApiHeader({ name: 'X-Webhook-Secret', required: true })
@Controller('webhooks/n8n')
@UseGuards(WebhookSecretGuard)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly priceMonitoringService: PriceMonitoringService,
  ) {}

  @Post('quotation-processed')
  @ApiOperation({
    summary: 'n8n callback: vendor quotation ingestion completed',
    description:
      'Called by n8n at the end of the vendor quotation ingestion workflow to report success/failure.',
  })
  quotationProcessed(@Body() dto: QuotationProcessedDto) {
    this.logger.log(
      `POST /webhooks/n8n/quotation-processed | executionId=${dto.executionId}`,
    );
    return this.webhooksService.handleQuotationProcessed(dto);
  }

  @Post('delivery-completed')
  @ApiOperation({
    summary: 'n8n callback: quotation email delivery completed',
    description:
      'Called by n8n after sending quotation PDF via email to the customer.',
  })
  deliveryCompleted(@Body() dto: DeliveryCompletedDto) {
    this.logger.log(
      `POST /webhooks/n8n/delivery-completed | executionId=${dto.executionId}`,
    );
    return this.webhooksService.handleDeliveryCompleted(dto);
  }

  @Post('execution-failed')
  @ApiOperation({
    summary: 'n8n callback: workflow execution failed (dead letter)',
    description:
      'Called by n8n error workflow when any workflow execution fails. Acts as a dead letter queue.',
  })
  executionFailed(@Body() dto: ExecutionFailedDto) {
    this.logger.log(
      `POST /webhooks/n8n/execution-failed | executionId=${dto.executionId}`,
    );
    return this.webhooksService.handleExecutionFailed(dto);
  }

  @Post('price-monitoring-completed')
  @ApiOperation({
    summary: 'n8n callback: price monitoring completed',
    description: 'Called by n8n after price monitoring workflow completes.',
  })
  priceMonitoringCompleted(@Body() dto: PriceMonitoringCallbackDto) {
    this.logger.log(
      `POST /webhooks/n8n/price-monitoring-completed | jobId=${dto.jobId}`,
    );
    return this.priceMonitoringService.handleCallback(dto);
  }
}
