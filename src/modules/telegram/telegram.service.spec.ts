import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { Quotation, QuotationStatus } from '../../database/entities/quotation.entity';
import { Customer } from '../../database/entities/customer.entity';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockBot: any;
  let mockQuotationRepo: any;
  let mockCustomerRepo: any;

  beforeEach(async () => {
    mockBot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue({}),
      },
    };

    mockQuotationRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockCustomerRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: 'DEFAULT_BOT_NAME',
          useValue: mockBot,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'telegram.chatId') return '123456';
              if (key === 'telegram.orgId') return 'org-1';
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(Quotation),
          useValue: mockQuotationRepo,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepo,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  describe('formatCurrency', () => {
    it('should format number as VND', () => {
      expect(service.formatCurrency(1500000)).toContain('VND');
    });

    it('should handle null', () => {
      expect(service.formatCurrency(null)).toBe('0 VND');
    });

    it('should handle undefined', () => {
      expect(service.formatCurrency(undefined)).toBe('0 VND');
    });

    it('should handle zero', () => {
      expect(service.formatCurrency(0)).toContain('0');
      expect(service.formatCurrency(0)).toContain('VND');
    });
  });

  describe('formatStatus', () => {
    it('should return icon + label for draft', () => {
      expect(service.formatStatus('draft')).toBe('📝 Draft');
    });

    it('should return icon + label for accepted', () => {
      expect(service.formatStatus('accepted')).toBe('✅ Accepted');
    });

    it('should return raw string for unknown', () => {
      expect(service.formatStatus('unknown')).toBe('unknown');
    });
  });

  describe('formatQuotation', () => {
    it('should format a quotation', () => {
      const q = {
        quotationNumber: 'BG-20260223-001',
        status: QuotationStatus.DRAFT,
        title: 'Test Quotation',
        total: 5000000,
        customer: { name: 'ACME Corp' },
        items: [{ id: '1' }, { id: '2' }],
      } as any;

      const result = service.formatQuotation(q);
      expect(result).toContain('BG-20260223-001');
      expect(result).toContain('Test Quotation');
      expect(result).toContain('ACME Corp');
      expect(result).toContain('2 item(s)');
    });
  });

  describe('formatQuotationList', () => {
    it('should return empty message when no quotations', () => {
      expect(service.formatQuotationList([])).toBe('No quotations found.');
    });

    it('should format list of quotations', () => {
      const quotations = [
        {
          quotationNumber: 'BG-001',
          title: 'Q1',
          status: 'draft',
          total: 1000000,
        },
        {
          quotationNumber: 'BG-002',
          title: 'Q2',
          status: 'sent',
          total: 2000000,
        },
      ] as any[];

      const result = service.formatQuotationList(quotations);
      expect(result).toContain('BG-001');
      expect(result).toContain('BG-002');
      expect(result).toContain('Q1');
      expect(result).toContain('Q2');
    });
  });

  describe('quotationKeyboard', () => {
    it('should return Send button for draft', () => {
      const kb = service.quotationKeyboard('uuid-1', QuotationStatus.DRAFT);
      expect(kb).toBeDefined();
    });

    it('should return Accept/Reject buttons for sent', () => {
      const kb = service.quotationKeyboard('uuid-1', QuotationStatus.SENT);
      expect(kb).toBeDefined();
    });

    it('should return undefined for accepted', () => {
      const kb = service.quotationKeyboard('uuid-1', QuotationStatus.ACCEPTED);
      expect(kb).toBeUndefined();
    });
  });

  describe('sendMessage', () => {
    it('should call bot.telegram.sendMessage', async () => {
      await service.sendMessage('Hello');
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123456',
        'Hello',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should not throw on error', async () => {
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Network'));
      await expect(service.sendMessage('test')).resolves.not.toThrow();
    });
  });

  describe('findRecentQuotations', () => {
    it('should call repository with correct params', async () => {
      mockQuotationRepo.find.mockResolvedValue([]);
      await service.findRecentQuotations(5);
      expect(mockQuotationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          take: 5,
        }),
      );
    });
  });

  describe('searchQuotations', () => {
    it('should call repository with search params', async () => {
      mockQuotationRepo.find.mockResolvedValue([]);
      await service.searchQuotations('laptop');
      expect(mockQuotationRepo.find).toHaveBeenCalled();
    });
  });
});
