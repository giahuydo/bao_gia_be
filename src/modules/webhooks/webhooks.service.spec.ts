import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhooksService } from './webhooks.service';
import { N8nExecutionLog } from '../../database/entities/n8n-execution-log.entity';
import { QuotationHistory } from '../../database/entities/quotation-history.entity';
import { Quotation } from '../../database/entities/quotation.entity';
import { IngestionJob } from '../../database/entities/ingestion-job.entity';
import { ProcessingStatus } from './dto/quotation-processed.dto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockExecutionLogRepo: Record<string, jest.Mock>;
  let mockHistoryRepo: Record<string, jest.Mock>;
  let mockQuotationsRepo: Record<string, jest.Mock>;
  let mockJobsRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockExecutionLogRepo = {
      create: jest.fn((data) => ({ id: 'log-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    mockHistoryRepo = {
      create: jest.fn((data) => ({ id: 'hist-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    mockQuotationsRepo = {
      findOne: jest.fn(),
    };
    mockJobsRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(N8nExecutionLog), useValue: mockExecutionLogRepo },
        { provide: getRepositoryToken(QuotationHistory), useValue: mockHistoryRepo },
        { provide: getRepositoryToken(Quotation), useValue: mockQuotationsRepo },
        { provide: getRepositoryToken(IngestionJob), useValue: mockJobsRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  describe('handleQuotationProcessed', () => {
    it('should log execution and return received', async () => {
      const result = await service.handleQuotationProcessed({
        executionId: 'exec-1',
        status: ProcessingStatus.SUCCESS,
        quotationId: 'q-1',
        processingTimeMs: 5000,
      });

      expect(result).toEqual({ received: true });
      expect(mockExecutionLogRepo.save).toHaveBeenCalled();
    });

    it('should record history on success with quotationId', async () => {
      await service.handleQuotationProcessed({
        executionId: 'exec-1',
        status: ProcessingStatus.SUCCESS,
        quotationId: 'q-1',
      });

      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quotationId: 'q-1',
          action: 'ai_extracted',
        }),
      );
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });

    it('should record failure history on failed status', async () => {
      await service.handleQuotationProcessed({
        executionId: 'exec-2',
        status: ProcessingStatus.FAILED,
        quotationId: 'q-2',
        error: 'AI extraction timeout',
      });

      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ingestion_failed',
          note: expect.stringContaining('AI extraction timeout'),
        }),
      );
    });

    it('should not record history when no quotationId', async () => {
      await service.handleQuotationProcessed({
        executionId: 'exec-3',
        status: ProcessingStatus.SUCCESS,
      });

      expect(mockHistoryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('handleDeliveryCompleted', () => {
    it('should log execution and record email_sent history', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue({ id: 'q-1' });

      const result = await service.handleDeliveryCompleted({
        executionId: 'exec-d1',
        quotationId: 'q-1',
        emailMessageId: 'msg-123',
        sentAt: '2026-02-22T10:00:00Z',
      });

      expect(result).toEqual({ received: true });
      expect(mockExecutionLogRepo.save).toHaveBeenCalled();
      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'email_sent' }),
      );
    });

    it('should throw NotFoundException if quotation not found', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleDeliveryCompleted({
          executionId: 'exec-d2',
          quotationId: 'nonexistent',
          sentAt: '2026-02-22T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not record history when delivery has error', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue({ id: 'q-1' });

      await service.handleDeliveryCompleted({
        executionId: 'exec-d3',
        quotationId: 'q-1',
        sentAt: '2026-02-22T10:00:00Z',
        error: 'SMTP connection refused',
      });

      expect(mockHistoryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('handleExecutionFailed', () => {
    it('should log failed execution', async () => {
      const result = await service.handleExecutionFailed({
        workflowName: 'vendor-quotation-ingestion',
        executionId: 'exec-f1',
        error: 'Timeout after 30s',
      });

      expect(result).toEqual({ received: true });
      expect(mockExecutionLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowName: 'vendor-quotation-ingestion',
          status: 'failed',
        }),
      );
    });
  });
});
