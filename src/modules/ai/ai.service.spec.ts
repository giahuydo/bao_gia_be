import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { TokenTrackingService } from './token-tracking.service';
import { Organization } from '../../database/entities/organization.entity';
import { TokenUsage } from '../../database/entities/token-usage.entity';

// Mock Anthropic SDK
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

describe('AiService', () => {
  let service: AiService;
  let mockTokenTracking: Partial<TokenTrackingService>;

  beforeEach(async () => {
    mockCreate.mockReset();
    mockTokenTracking = {
      track: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-api-key') },
        },
        { provide: TokenTrackingService, useValue: mockTokenTracking },
        {
          provide: getRepositoryToken(Organization),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(TokenUsage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
            getRawOne: jest.fn().mockResolvedValue(null),
          }) },
        },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('generateQuotation', () => {
    it('should return parsed JSON from AI response', async () => {
      const mockQuotation = {
        title: 'Test Quotation',
        items: [{ name: 'Item 1', unitPrice: 1000000 }],
        notes: 'Test notes',
        terms: 'Test terms',
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockQuotation) }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const result = await service.generateQuotation('Build a website');
      expect(result.title).toBe('Test Quotation');
      expect(result.items).toHaveLength(1);
      expect(mockTokenTracking.track).toHaveBeenCalled();
    });

    it('should handle AI response with surrounding text', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Here is the quotation:\n{"title":"Test","items":[],"notes":null,"terms":null}\nDone!',
          },
        ],
        usage: { input_tokens: 50, output_tokens: 100 },
      });

      const result = await service.generateQuotation('test');
      expect(result.title).toBe('Test');
    });

    it('should throw HttpException on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API timeout'));

      await expect(service.generateQuotation('test')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw on non-text response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'image' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      await expect(service.generateQuotation('test')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('suggestItems', () => {
    it('should return array of suggested items', async () => {
      const mockItems = [
        { name: 'Item A', unit: 'cai', quantity: 1, unitPrice: 5000000 },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockItems) }],
        usage: { input_tokens: 80, output_tokens: 150 },
      });

      const result = await service.suggestItems('Website development');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Item A');
    });

    it('should include existing items context', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '[]' }],
        usage: { input_tokens: 80, output_tokens: 10 },
      });

      await service.suggestItems('Test', ['Existing Item']);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Existing Item');
    });
  });

  describe('improveDescription', () => {
    it('should return improved description', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Professional improved description' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      });

      const result = await service.improveDescription('Server', 'A server');
      expect(result.improvedDescription).toBe(
        'Professional improved description',
      );
    });
  });
});
