import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { IngestionService } from './ingestion.service';
import { ServiceAuthGuard } from '../../common/guards/service-auth.guard';
import { ExtractDocumentDto } from './dto/extract-document.dto';
import { TranslateDataDto } from './dto/translate-data.dto';
import { NormalizeDataDto } from './dto/normalize-data.dto';

@ApiTags('ingestion')
@ApiHeader({ name: 'X-Service-Key', required: true })
@ApiHeader({ name: 'X-N8N-Execution-Id', required: false })
@ApiHeader({ name: 'X-Job-Id', required: false })
@ApiHeader({ name: 'X-Organization-Id', required: false })
@Controller('ingestion')
@UseGuards(ServiceAuthGuard)
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post('extract')
  @ApiOperation({
    summary: 'Extract structured data from a vendor document using AI',
    description:
      'Reads the uploaded attachment, sends it to Claude for extraction, returns structured JSON. Called by n8n ingestion workflow.',
  })
  async extract(@Body() dto: ExtractDocumentDto, @Req() req: Request) {
    const executionId = (req as any).n8nExecutionId;
    const jobId = req.headers['x-job-id'] as string;
    const organizationId = req.headers['x-organization-id'] as string;
    const startTime = Date.now();

    this.logger.log(
      `POST /ingestion/extract | attachmentId=${dto.attachmentId} | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    const result = await this.ingestionService.extractFromDocument(
      dto.attachmentId,
      executionId,
      jobId,
      organizationId,
    );

    this.logger.log(
      `Extract completed in ${Date.now() - startTime}ms | items=${result.items.length}`,
    );

    return result;
  }

  @Post('translate')
  @ApiOperation({
    summary: 'Translate extracted quotation data to Vietnamese',
    description:
      'Takes extracted data (from /extract step), translates all fields to Vietnamese using Claude. Injects org glossary terms. Called by n8n ingestion workflow.',
  })
  async translate(@Body() dto: TranslateDataDto, @Req() req: Request) {
    const executionId = (req as any).n8nExecutionId;
    const jobId = req.headers['x-job-id'] as string;
    const organizationId = req.headers['x-organization-id'] as string;
    const startTime = Date.now();

    this.logger.log(
      `POST /ingestion/translate | items=${dto.extractedData.items.length} | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    const result = await this.ingestionService.translateToEnglish(
      dto.extractedData,
      executionId,
      jobId,
      organizationId,
    );

    this.logger.log(
      `Translate completed in ${Date.now() - startTime}ms`,
    );

    return result;
  }

  @Post('normalize')
  @ApiOperation({
    summary: 'Normalize translated data against product catalog and customers',
    description:
      'Matches items to existing products, validates data, resolves customer. Called by n8n ingestion workflow after /translate.',
  })
  async normalize(@Body() dto: NormalizeDataDto, @Req() req: Request) {
    const executionId = (req as any).n8nExecutionId;
    const jobId = req.headers['x-job-id'] as string;
    const organizationId = req.headers['x-organization-id'] as string;
    const startTime = Date.now();

    this.logger.log(
      `POST /ingestion/normalize | items=${dto.translatedData.items.length} | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    const result = await this.ingestionService.normalizeData(
      dto.translatedData,
      dto.customerId,
      executionId,
      jobId,
      organizationId,
    );

    this.logger.log(
      `Normalize completed in ${Date.now() - startTime}ms | warnings=${result.warnings.length}`,
    );

    return result;
  }
}
