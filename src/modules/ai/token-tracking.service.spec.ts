import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenTrackingService } from './token-tracking.service';
import { TokenUsage, AiOperation } from '../../database/entities/token-usage.entity';

describe('TokenTrackingService', () => {
  let service: TokenTrackingService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ id: 'uuid-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(() => Promise.resolve([])),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenTrackingService,
        { provide: getRepositoryToken(TokenUsage), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(TokenTrackingService);
  });

  describe('track', () => {
    it('should save a record with correct cost calculation (Sonnet)', async () => {
      await service.track({
        operation: AiOperation.GENERATE,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: AiOperation.GENERATE,
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        }),
      );

      // Sonnet: $3/1M input + $15/1M output
      const created = mockRepo.create.mock.calls[0][0];
      const expectedCost = 1000 * (3 / 1_000_000) + 500 * (15 / 1_000_000);
      expect(created.costUsd).toBeCloseTo(expectedCost, 6);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should use default pricing for unknown models', async () => {
      await service.track({
        operation: AiOperation.SUGGEST,
        model: 'unknown-model',
        inputTokens: 100,
        outputTokens: 50,
      });

      const created = mockRepo.create.mock.calls[0][0];
      const expectedCost = 100 * (3 / 1_000_000) + 50 * (15 / 1_000_000);
      expect(created.costUsd).toBeCloseTo(expectedCost, 6);
    });

    it('should not throw when save fails', async () => {
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      const result = await service.track({
        operation: AiOperation.IMPROVE,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(result).toBeDefined();
    });
  });

  describe('getUsageSummary', () => {
    it('should return empty summary when no records', async () => {
      const result = await service.getUsageSummary({});
      expect(result.totalRequests).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });

    it('should aggregate by operation and model', async () => {
      mockRepo.find.mockResolvedValue([
        {
          operation: AiOperation.GENERATE,
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costUsd: 0.0105,
        },
        {
          operation: AiOperation.SUGGEST,
          model: 'claude-sonnet-4-20250514',
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          costUsd: 0.0084,
        },
      ]);

      const result = await service.getUsageSummary({});
      expect(result.totalRequests).toBe(2);
      expect(result.totalTokens).toBe(2700);
      expect(result.byOperation[AiOperation.GENERATE].requests).toBe(1);
      expect(result.byOperation[AiOperation.SUGGEST].requests).toBe(1);
      expect(result.byModel['claude-sonnet-4-20250514'].requests).toBe(2);
    });
  });

  describe('getUsageRecords', () => {
    it('should return paginated results', async () => {
      mockRepo.findAndCount.mockResolvedValue([[{ id: '1' }], 1]);

      const result = await service.getUsageRecords({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should default to page 1 and limit 50', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getUsageRecords({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });
});
