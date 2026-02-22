import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  N8nExecutionLog,
  ExecutionStatus,
} from '../../database/entities/n8n-execution-log.entity';
import {
  QuotationHistory,
  HistoryAction,
} from '../../database/entities/quotation-history.entity';
import { Quotation } from '../../database/entities/quotation.entity';
import {
  QuotationProcessedDto,
  ProcessingStatus,
} from './dto/quotation-processed.dto';
import { DeliveryCompletedDto } from './dto/delivery-completed.dto';
import { ExecutionFailedDto } from './dto/execution-failed.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // System actor ID used for n8n-triggered history entries.
  // In production, seed a system user with this fixed UUID.
  static readonly SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectRepository(N8nExecutionLog)
    private executionLogRepository: Repository<N8nExecutionLog>,
    @InjectRepository(QuotationHistory)
    private historyRepository: Repository<QuotationHistory>,
    @InjectRepository(Quotation)
    private quotationsRepository: Repository<Quotation>,
  ) {}

  private mapProcessingStatus(status: ProcessingStatus): ExecutionStatus {
    switch (status) {
      case ProcessingStatus.SUCCESS:
        return ExecutionStatus.SUCCESS;
      case ProcessingStatus.PARTIAL:
        return ExecutionStatus.PARTIAL;
      default:
        return ExecutionStatus.FAILED;
    }
  }

  private createExecutionLog(data: {
    workflowName: string;
    executionId: string;
    status: ExecutionStatus;
    quotationId?: string;
    processingTimeMs?: number;
    error?: string;
    payload?: Record<string, any>;
  }): N8nExecutionLog {
    return this.executionLogRepository.create({
      workflowName: data.workflowName,
      executionId: data.executionId,
      status: data.status,
      quotationId: data.quotationId,
      processingTimeMs: data.processingTimeMs,
      error: data.error,
      payload: data.payload,
    });
  }

  async handleQuotationProcessed(
    dto: QuotationProcessedDto,
  ): Promise<{ received: true }> {
    this.logger.log(
      `Quotation processed callback | executionId=${dto.executionId} | status=${dto.status} | quotationId=${dto.quotationId || 'none'}`,
    );

    // Log the execution
    const log = this.createExecutionLog({
      workflowName: 'vendor-quotation-ingestion',
      executionId: dto.executionId,
      status: this.mapProcessingStatus(dto.status),
      quotationId: dto.quotationId,
      processingTimeMs: dto.processingTimeMs,
      error: dto.error,
      payload: { source: 'quotation-processed' },
    });
    await this.executionLogRepository.save(log);

    // If a quotation was created, record it in quotation history
    if (dto.quotationId && dto.status === ProcessingStatus.SUCCESS) {
      const history = this.historyRepository.create({
        quotationId: dto.quotationId,
        action: HistoryAction.AI_EXTRACTED,
        performedBy: WebhooksService.SYSTEM_ACTOR_ID,
        note: `Quotation created via n8n ingestion pipeline (execution: ${dto.executionId})`,
        changes: {
          executionId: dto.executionId,
          processingTimeMs: dto.processingTimeMs,
        },
      });
      await this.historyRepository.save(history);
    }

    // If failed, log that too
    if (dto.quotationId && dto.status === ProcessingStatus.FAILED) {
      const history = this.historyRepository.create({
        quotationId: dto.quotationId,
        action: HistoryAction.INGESTION_FAILED,
        performedBy: WebhooksService.SYSTEM_ACTOR_ID,
        note: `Ingestion failed: ${dto.error || 'unknown error'}`,
        changes: { executionId: dto.executionId, error: dto.error },
      });
      await this.historyRepository.save(history);
    }

    return { received: true };
  }

  async handleDeliveryCompleted(
    dto: DeliveryCompletedDto,
  ): Promise<{ received: true }> {
    this.logger.log(
      `Delivery completed callback | executionId=${dto.executionId} | quotationId=${dto.quotationId}`,
    );

    // Verify quotation exists
    const quotation = await this.quotationsRepository.findOne({
      where: { id: dto.quotationId },
    });
    if (!quotation) {
      throw new NotFoundException(
        `Quotation ${dto.quotationId} not found`,
      );
    }

    // Log the execution
    const log = this.createExecutionLog({
      workflowName: 'quotation-delivery',
      executionId: dto.executionId,
      status: dto.error ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS,
      quotationId: dto.quotationId,
      error: dto.error,
      payload: {
        source: 'delivery-completed',
        emailMessageId: dto.emailMessageId,
        sentAt: dto.sentAt,
      },
    });
    await this.executionLogRepository.save(log);

    // Record in quotation history
    if (!dto.error) {
      const history = this.historyRepository.create({
        quotationId: dto.quotationId,
        action: HistoryAction.EMAIL_SENT,
        performedBy: WebhooksService.SYSTEM_ACTOR_ID,
        note: `Quotation sent via email (messageId: ${dto.emailMessageId || 'n/a'})`,
        changes: {
          executionId: dto.executionId,
          emailMessageId: dto.emailMessageId,
          sentAt: dto.sentAt,
        },
      });
      await this.historyRepository.save(history);
    }

    return { received: true };
  }

  async handleExecutionFailed(
    dto: ExecutionFailedDto,
  ): Promise<{ received: true }> {
    this.logger.error(
      `n8n execution failed | workflow=${dto.workflowName} | executionId=${dto.executionId} | error=${dto.error}`,
    );

    const log = this.createExecutionLog({
      workflowName: dto.workflowName,
      executionId: dto.executionId,
      status: ExecutionStatus.FAILED,
      error: dto.error,
      payload: dto.inputData,
    });
    await this.executionLogRepository.save(log);

    return { received: true };
  }
}
