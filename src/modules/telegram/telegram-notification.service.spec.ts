import { Test, TestingModule } from '@nestjs/testing';
import { TelegramNotificationService } from './telegram-notification.service';
import { TelegramService } from './telegram.service';
import {
  QuotationStatusChangedEvent,
  IngestionJobCompletedEvent,
  ReviewRequestCreatedEvent,
} from './events/telegram.events';

describe('TelegramNotificationService', () => {
  let service: TelegramNotificationService;
  let mockTelegramService: any;

  beforeEach(async () => {
    mockTelegramService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      formatStatus: jest.fn((s) => s),
      formatCurrency: jest.fn((a) => `${a} VND`),
      quotationKeyboard: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramNotificationService,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
      ],
    }).compile();

    service = module.get<TelegramNotificationService>(TelegramNotificationService);
  });

  describe('handleQuotationStatusChanged', () => {
    it('should send message with status change info', async () => {
      const event = new QuotationStatusChangedEvent(
        'uuid-1',
        'BG-001',
        'Test Quote',
        'draft',
        'sent',
        'user-1',
        5000000,
        'ACME Corp',
      );

      await service.handleQuotationStatusChanged(event);

      expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
      const message = mockTelegramService.sendMessage.mock.calls[0][0];
      expect(message).toContain('BG-001');
      expect(message).toContain('Test Quote');
      expect(message).toContain('Status Changed');
    });

    it('should not throw on error', async () => {
      mockTelegramService.sendMessage.mockRejectedValue(new Error('fail'));
      const event = new QuotationStatusChangedEvent(
        'uuid-1', 'BG-001', 'Test', 'draft', 'sent', 'user-1',
      );
      await expect(service.handleQuotationStatusChanged(event)).resolves.not.toThrow();
    });
  });

  describe('handleJobCompleted', () => {
    it('should send message for completed job', async () => {
      const event = new IngestionJobCompletedEvent(
        'job-1',
        'completed',
        'q-1',
        'BG-001',
      );

      await service.handleJobCompleted(event);

      expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
      const message = mockTelegramService.sendMessage.mock.calls[0][0];
      expect(message).toContain('COMPLETED');
      expect(message).toContain('BG-001');
    });

    it('should include error for failed job', async () => {
      const event = new IngestionJobCompletedEvent(
        'job-2',
        'failed',
        undefined,
        undefined,
        'Extraction timeout',
      );

      await service.handleJobCompleted(event);

      const message = mockTelegramService.sendMessage.mock.calls[0][0];
      expect(message).toContain('FAILED');
      expect(message).toContain('Extraction timeout');
    });
  });

  describe('handleJobFailed', () => {
    it('should delegate to handleJobCompleted', async () => {
      const event = new IngestionJobCompletedEvent('job-3', 'failed');
      await service.handleJobFailed(event);
      expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleReviewCreated', () => {
    it('should send message with review info and keyboard', async () => {
      const event = new ReviewRequestCreatedEvent(
        'review-1',
        'ingestion',
        'John Doe',
        'q-1',
        'BG-001',
        'Jane Smith',
      );

      await service.handleReviewCreated(event);

      expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
      const message = mockTelegramService.sendMessage.mock.calls[0][0];
      expect(message).toContain('Review Request');
      expect(message).toContain('ingestion');
      expect(message).toContain('John Doe');
      expect(message).toContain('BG-001');
    });

    it('should not throw on error', async () => {
      mockTelegramService.sendMessage.mockRejectedValue(new Error('fail'));
      const event = new ReviewRequestCreatedEvent(
        'r-1', 'ingestion', 'John',
      );
      await expect(service.handleReviewCreated(event)).resolves.not.toThrow();
    });
  });
});
