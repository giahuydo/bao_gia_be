import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { Attachment } from '../../database/entities/attachment.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { IngestionJob, JobStatus } from '../../database/entities/ingestion-job.entity';
import { FileChecksumCache } from '../../database/entities/file-checksum-cache.entity';
import { GlossaryTerm } from '../../database/entities/glossary-term.entity';
import { AiPromptVersion, PromptType } from '../../database/entities/ai-prompt-version.entity';
import { TokenTrackingService } from '../ai/token-tracking.service';

// Mock fs and crypto modules used by IngestionService
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('abc123checksum'),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMock = require('fs') as jest.Mocked<typeof import('fs')>;

const ORG_ID = 'org-uuid-1';
const ATTACHMENT_ID = 'attachment-uuid-1';
const JOB_ID = 'job-uuid-1';
const EXECUTION_ID = 'exec-uuid-1';
const CUSTOMER_ID = 'customer-uuid-1';
const PRODUCT_ID = 'product-uuid-1';

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment =>
  ({
    id: ATTACHMENT_ID,
    organizationId: ORG_ID,
    quotationId: 'quotation-uuid-1',
    fileName: 'vendor-quote.pdf',
    originalName: 'Vendor Quote 2024.pdf',
    mimeType: 'application/pdf',
    fileSize: 102400,
    filePath: '/uploads/vendor-quote.pdf',
    uploadedBy: 'user-uuid-1',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as Attachment);

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: PRODUCT_ID,
    organizationId: ORG_ID,
    name: 'Centrifuge Model X200',
    description: 'High-speed centrifuge',
    unit: 'unit',
    defaultPrice: 15000,
    category: 'lab',
    isActive: true,
    currencyId: null,
    createdBy: 'user-uuid-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Product);

const makeCustomer = (overrides: Partial<Customer> = {}): Customer =>
  ({
    id: CUSTOMER_ID,
    organizationId: ORG_ID,
    name: 'ABC Medical Supplies',
    email: 'abc@medical.com',
    phone: '0901234567',
    address: '123 Ho Chi Minh City',
    taxCode: '0123456789',
    contactPerson: 'Nguyen Van A',
    notes: null,
    quotations: [],
    createdBy: 'user-uuid-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as Customer);

const makeJob = (overrides: Partial<IngestionJob> = {}): IngestionJob =>
  ({
    id: JOB_ID,
    organizationId: ORG_ID,
    attachmentId: ATTACHMENT_ID,
    status: JobStatus.PENDING,
    currentStep: null,
    retries: 0,
    maxRetries: 3,
    fileChecksum: null,
    extractResult: null,
    translateResult: null,
    normalizeResult: null,
    quotationId: null,
    error: null,
    errorStack: null,
    n8nExecutionId: null,
    correlationId: null,
    promptVersionId: null,
    customerId: null,
    createdBy: 'user-uuid-1',
    processingTimeMs: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as IngestionJob);

const makeChecksumCache = (overrides: Partial<FileChecksumCache> = {}): FileChecksumCache =>
  ({
    id: 'cache-uuid-1',
    checksum: 'abc123checksum',
    organizationId: ORG_ID,
    originalFileName: 'Vendor Quote 2024.pdf',
    mimeType: 'application/pdf',
    fileSize: 102400,
    extractResult: {
      title: 'Cached Quotation',
      vendorName: 'ABC Vendor',
      items: [
        {
          name: 'Centrifuge',
          description: 'Lab centrifuge',
          unit: 'unit',
          quantity: 1,
          unitPrice: 15000,
          currency: 'USD',
        },
      ],
      notes: null,
      terms: null,
      confidence: 0.95,
      extractionWarnings: [],
    },
    translateResult: null,
    promptVersionId: null,
    hitCount: 0,
    lastHitAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days future
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as FileChecksumCache);

const makeGlossaryTerm = (overrides: Partial<GlossaryTerm> = {}): GlossaryTerm =>
  ({
    id: 'glossary-uuid-1',
    organizationId: ORG_ID,
    sourceTerm: 'centrifuge',
    targetTerm: 'may ly tam',
    sourceLanguage: 'en',
    targetLanguage: 'vi',
    category: 'lab',
    createdBy: 'user-uuid-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as GlossaryTerm);

const makePromptVersion = (overrides: Partial<AiPromptVersion> = {}): AiPromptVersion =>
  ({
    id: 'prompt-uuid-1',
    type: PromptType.EXTRACT,
    versionNumber: 1,
    systemPrompt: 'Custom system prompt',
    userPromptTemplate: 'Custom user template',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    isActive: true,
    changeNotes: null,
    createdBy: 'user-uuid-1',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as AiPromptVersion);

// Shared extracted data for translate and normalize tests
const extractedItems = [
  {
    name: 'Centrifuge Model X200',
    description: 'High-speed centrifuge',
    unit: 'unit',
    quantity: 2,
    unitPrice: 15000,
    currency: 'USD',
  },
];

const translatedItems = [
  {
    name: 'Centrifuge Model X200',
    description: 'High-speed centrifuge',
    unit: 'unit',
    quantity: 2,
    unitPrice: 15000,
    currency: 'USD',
  },
];

describe('IngestionService', () => {
  let service: IngestionService;
  let mockAttachmentsRepo: Record<string, jest.Mock>;
  let mockProductsRepo: Record<string, jest.Mock>;
  let mockCustomersRepo: Record<string, jest.Mock>;
  let mockJobsRepo: Record<string, jest.Mock>;
  let mockChecksumCacheRepo: Record<string, jest.Mock>;
  let mockGlossaryRepo: Record<string, jest.Mock>;
  let mockPromptVersionRepo: Record<string, jest.Mock>;
  let mockTokenTracking: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockAnthropicCreate: jest.Mock;

  // Helper to create a successful AI response
  const makeAiResponse = (jsonPayload: object) => ({
    content: [{ type: 'text', text: JSON.stringify(jsonPayload) }],
    usage: { input_tokens: 100, output_tokens: 200 },
  });

  beforeEach(async () => {
    // Reset fs mocks
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue(Buffer.from('fake file content'));

    mockAnthropicCreate = jest.fn();

    // Mock the Anthropic SDK constructor
    jest.mock('@anthropic-ai/sdk', () => {
      return {
        default: jest.fn().mockImplementation(() => ({
          messages: { create: mockAnthropicCreate },
        })),
      };
    });

    mockAttachmentsRepo = {
      findOne: jest.fn(),
    };

    mockProductsRepo = {
      findOne: jest.fn(),
    };

    mockCustomersRepo = {
      findOne: jest.fn(),
    };

    mockJobsRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockChecksumCacheRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue({}),
    };

    mockGlossaryRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockPromptVersionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockTokenTracking = {
      track: jest.fn().mockResolvedValue({}),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenTrackingService, useValue: mockTokenTracking },
        { provide: getRepositoryToken(Attachment), useValue: mockAttachmentsRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductsRepo },
        { provide: getRepositoryToken(Customer), useValue: mockCustomersRepo },
        { provide: getRepositoryToken(IngestionJob), useValue: mockJobsRepo },
        { provide: getRepositoryToken(FileChecksumCache), useValue: mockChecksumCacheRepo },
        { provide: getRepositoryToken(GlossaryTerm), useValue: mockGlossaryRepo },
        { provide: getRepositoryToken(AiPromptVersion), useValue: mockPromptVersionRepo },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);

    // Patch the internal Anthropic client after construction
    (service as any).client = { messages: { create: mockAnthropicCreate } };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // extractFromDocument()
  // ---------------------------------------------------------------------------
  describe('extractFromDocument', () => {
    const extractedPayload = {
      title: 'Vendor Quote #VQ-001',
      vendorName: 'ABC Vendor',
      items: [
        {
          name: 'Centrifuge Model X200',
          description: 'High-speed centrifuge',
          unit: 'unit',
          quantity: 2,
          unitPrice: 15000,
          currency: 'USD',
          catalogNumber: 'X200',
          category: 'lab',
        },
      ],
      notes: 'Delivery in 30 days',
      terms: 'Net 30',
      confidence: 0.95,
      extractionWarnings: [],
    };

    beforeEach(() => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());
      mockChecksumCacheRepo.findOne.mockResolvedValue(null); // no cache hit by default
      mockAnthropicCreate.mockResolvedValue(makeAiResponse(extractedPayload));
    });

    it('should extract items from a PDF attachment', async () => {
      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.title).toBe('Vendor Quote #VQ-001');
      expect(result.vendorName).toBe('ABC Vendor');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Centrifuge Model X200');
      expect(result.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 200 });
    });

    it('should throw NotFoundException when attachment is not found', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(`Attachment ${ATTACHMENT_ID} not found`);
    });

    it('should throw NotFoundException when file does not exist on disk', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());
      fsMock.existsSync.mockReturnValue(false);

      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow('File not found on disk');
    });

    it('should throw BadRequestException for unsupported MIME type', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(
        makeAttachment({ mimeType: 'application/zip' }),
      );

      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow('Unsupported file type: application/zip');
    });

    it('should return cached result on cache hit without calling AI', async () => {
      const cached = makeChecksumCache();
      mockChecksumCacheRepo.findOne.mockResolvedValue(cached);

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.cacheHit).toBe(true);
      expect(result.title).toBe('Cached Quotation');
      expect(result.tokenUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('should increment cache hit count on cache hit', async () => {
      const cached = makeChecksumCache({ hitCount: 5 });
      mockChecksumCacheRepo.findOne.mockResolvedValue(cached);

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockChecksumCacheRepo.update).toHaveBeenCalledWith(
        cached.id,
        expect.objectContaining({ hitCount: 6 }),
      );
    });

    it('should track token usage after successful extraction', async () => {
      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 100,
          outputTokens: 200,
          n8nExecutionId: EXECUTION_ID,
          tenantId: ORG_ID,
        }),
      );
    });

    it('should update job status to EXTRACTING at the start', async () => {
      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        JOB_ID,
        expect.objectContaining({ status: JobStatus.EXTRACTING }),
      );
    });

    it('should update job status to FAILED when attachment not found', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(null);

      try {
        await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);
      } catch {
        // expected
      }

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        JOB_ID,
        expect.objectContaining({ status: JobStatus.FAILED }),
      );
    });

    it('should add warning for item with null unit price', async () => {
      const payloadWithNullPrice = {
        ...extractedPayload,
        items: [{ ...extractedPayload.items[0], unitPrice: null }],
        extractionWarnings: [],
      };
      mockAnthropicCreate.mockResolvedValue(makeAiResponse(payloadWithNullPrice));

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        undefined,
        ORG_ID,
      );

      expect(result.extractionWarnings?.some((w) => w.includes('null price'))).toBe(true);
    });

    it('should add warning for unusually high unit price', async () => {
      const highPricePayload = {
        ...extractedPayload,
        items: [{ ...extractedPayload.items[0], unitPrice: 50_000_000 }],
        extractionWarnings: [],
      };
      mockAnthropicCreate.mockResolvedValue(makeAiResponse(highPricePayload));

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        undefined,
        ORG_ID,
      );

      expect(result.extractionWarnings?.some((w) => w.includes('unusually high price'))).toBe(true);
    });

    it('should add warning for unusually high quantity', async () => {
      const highQtyPayload = {
        ...extractedPayload,
        items: [{ ...extractedPayload.items[0], quantity: 99999 }],
        extractionWarnings: [],
      };
      mockAnthropicCreate.mockResolvedValue(makeAiResponse(highQtyPayload));

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        undefined,
        ORG_ID,
      );

      expect(result.extractionWarnings?.some((w) => w.includes('unusually high quantity'))).toBe(
        true,
      );
    });

    it('should throw BadRequestException when AI response is not text type', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'tool-1', name: 'some_tool', input: {} }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, undefined, ORG_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, undefined, ORG_ID),
      ).rejects.toThrow('Unexpected AI response type');
    });

    it('should throw BadRequestException when AI response has no JSON', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'No JSON here, just text.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, undefined, ORG_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, undefined, ORG_ID),
      ).rejects.toThrow('Could not parse JSON from AI extraction response');
    });

    it('should use active prompt version model and maxTokens when available', async () => {
      const promptVersion = makePromptVersion({ model: 'claude-haiku-4-5-20251001', maxTokens: 2048 });
      mockPromptVersionRepo.findOne.mockResolvedValue(promptVersion);

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
        }),
      );
    });

    it('should use default model when no active prompt version exists', async () => {
      mockPromptVersionRepo.findOne.mockResolvedValue(null);

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-20250514' }),
      );
    });

    it('should handle image MIME types with image block content', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment({ mimeType: 'image/png' }));

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      const call = mockAnthropicCreate.mock.calls[0][0];
      const userContent = call.messages[0].content;
      expect(userContent.some((block: any) => block.type === 'image')).toBe(true);
    });

    it('should handle text-based MIME types with text block content', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment({ mimeType: 'text/plain' }));

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      const call = mockAnthropicCreate.mock.calls[0][0];
      const userContent = call.messages[0].content;
      expect(userContent.some((block: any) => block.type === 'text')).toBe(true);
    });

    it('should store file checksum in job when organizationId is provided', async () => {
      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        JOB_ID,
        expect.objectContaining({ fileChecksum: 'abc123checksum' }),
      );
    });

    it('should work without jobId (no job status updates)', async () => {
      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        undefined,
        ORG_ID,
      );

      // The update for starting extracting uses undefined jobId -- should be skipped
      expect(mockJobsRepo.update).not.toHaveBeenCalledWith(undefined, expect.anything());
      expect(result.items).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // translateToEnglish()
  // ---------------------------------------------------------------------------
  describe('translateToEnglish', () => {
    const translatedPayload = {
      title: 'Quotation from ABC Vendor',
      vendorName: 'ABC Vendor',
      items: translatedItems,
      notes: 'Delivery in 30 days',
      terms: 'Net 30 payment',
    };

    const inputData = {
      title: 'Vendor Quote #VQ-001',
      vendorName: 'ABC Vendor',
      items: extractedItems,
      notes: 'Delivery in 30 days',
      terms: 'Net 30',
    };

    beforeEach(() => {
      mockAnthropicCreate.mockResolvedValue(makeAiResponse(translatedPayload));
    });

    it('should translate items and return English result', async () => {
      const result = await service.translateToEnglish(
        inputData,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.title).toBe('Quotation from ABC Vendor');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Centrifuge Model X200');
      expect(result.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 200 });
    });

    it('should update job status to TRANSLATING at the start', async () => {
      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        JOB_ID,
        expect.objectContaining({ status: JobStatus.TRANSLATING }),
      );
    });

    it('should inject glossary terms into the system prompt', async () => {
      const glossaryTerm = makeGlossaryTerm();
      mockGlossaryRepo.find.mockResolvedValue([glossaryTerm]);

      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      const call = mockAnthropicCreate.mock.calls[0][0];
      expect(call.system).toContain('centrifuge');
      expect(call.system).toContain('may ly tam');
    });

    it('should not inject glossary section when there are no glossary terms', async () => {
      mockGlossaryRepo.find.mockResolvedValue([]);

      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      const call = mockAnthropicCreate.mock.calls[0][0];
      expect(call.system).not.toContain('Use these EXACT translations');
    });

    it('should not load glossary when organizationId is not provided', async () => {
      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, undefined);

      expect(mockGlossaryRepo.find).not.toHaveBeenCalled();
    });

    it('should track token usage after translation', async () => {
      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 100,
          outputTokens: 200,
          n8nExecutionId: EXECUTION_ID,
          tenantId: ORG_ID,
        }),
      );
    });

    it('should throw BadRequestException when AI returns non-text response', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'tool-1', name: 'some_tool', input: {} }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(
        service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow('Unexpected AI response type');
    });

    it('should throw BadRequestException when AI response has no valid JSON', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Translation complete but no JSON' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(
        service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID),
      ).rejects.toThrow('Could not parse JSON from AI translation response');
    });

    it('should use active prompt version for translate type', async () => {
      const promptVersion = makePromptVersion({ type: PromptType.TRANSLATE, model: 'claude-haiku-4-5-20251001' });
      mockPromptVersionRepo.findOne.mockResolvedValue(promptVersion);

      await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
      );
    });

    it('should return null for title when not present in AI response', async () => {
      mockAnthropicCreate.mockResolvedValue(
        makeAiResponse({ ...translatedPayload, title: null }),
      );

      const result = await service.translateToEnglish(inputData, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(result.title).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // normalizeData()
  // ---------------------------------------------------------------------------
  describe('normalizeData', () => {
    const translatedData = {
      title: 'Quotation from ABC Medical Supplies',
      vendorName: 'ABC Medical Supplies',
      items: translatedItems,
      notes: 'Delivery in 30 days',
      terms: 'Net 30 payment',
    };

    beforeEach(() => {
      mockProductsRepo.findOne.mockResolvedValue(null); // no product match by default
      mockCustomersRepo.findOne.mockResolvedValue(null);
    });

    it('should return normalized items with title and empty warnings when all match', async () => {
      mockProductsRepo.findOne.mockResolvedValue(makeProduct());

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.title).toBe('Quotation from ABC Medical Supplies');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].matchConfidence).toBe('exact');
      expect(result.items[0].productId).toBe(PRODUCT_ID);
    });

    it('should update job status to NORMALIZING at the start', async () => {
      await service.normalizeData(translatedData, undefined, EXECUTION_ID, JOB_ID, ORG_ID);

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        JOB_ID,
        expect.objectContaining({ status: JobStatus.NORMALIZING }),
      );
    });

    it('should find customer by provided customerId', async () => {
      mockCustomersRepo.findOne.mockResolvedValue(makeCustomer());

      const result = await service.normalizeData(
        translatedData,
        CUSTOMER_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.customerId).toBe(CUSTOMER_ID);
      expect(result.customerMatch).toEqual({ id: CUSTOMER_ID, name: 'ABC Medical Supplies' });
    });

    it('should add warning when provided customerId is not found', async () => {
      mockCustomersRepo.findOne.mockResolvedValue(null);

      const result = await service.normalizeData(
        translatedData,
        CUSTOMER_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.customerId).toBeNull();
      expect(result.warnings.some((w) => w.includes(CUSTOMER_ID))).toBe(true);
    });

    it('should fuzzy-match customer by vendorName when no customerId provided', async () => {
      mockCustomersRepo.findOne.mockResolvedValue(makeCustomer());

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.customerMatch).not.toBeNull();
    });

    it('should add warning when no customer match found for vendorName', async () => {
      mockCustomersRepo.findOne.mockResolvedValue(null);

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.customerMatch).toBeNull();
      expect(result.warnings.some((w) => w.includes('ABC Medical Supplies'))).toBe(true);
    });

    it('should mark item as exact match when product name matches exactly', async () => {
      const product = makeProduct({ name: 'Centrifuge Model X200' });
      mockProductsRepo.findOne.mockResolvedValue(product);

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].matchConfidence).toBe('exact');
      expect(result.items[0].productId).toBe(product.id);
    });

    it('should mark item as fuzzy match and add warning on fuzzy product match', async () => {
      const exactProduct = null;
      const fuzzyProduct = makeProduct({ name: 'Centrifuge X200 Pro' });
      mockProductsRepo.findOne
        .mockResolvedValueOnce(exactProduct) // exact match fails
        .mockResolvedValueOnce(fuzzyProduct); // fuzzy match succeeds

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].matchConfidence).toBe('fuzzy');
      expect(result.items[0].productId).toBe(fuzzyProduct.id);
      expect(result.warnings.some((w) => w.includes('fuzzy-matched'))).toBe(true);
    });

    it('should mark item as no match when no product found', async () => {
      mockProductsRepo.findOne.mockResolvedValue(null);

      const result = await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].matchConfidence).toBe('none');
      expect(result.items[0].productId).toBeNull();
    });

    it('should default invalid quantity to 1 with a warning', async () => {
      const dataWithBadQty = {
        ...translatedData,
        items: [{ ...translatedItems[0], quantity: -5 }],
      };

      const result = await service.normalizeData(
        dataWithBadQty,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].quantity).toBe(1);
      expect(result.warnings.some((w) => w.includes('invalid quantity'))).toBe(true);
    });

    it('should default invalid unitPrice to 0 with a warning', async () => {
      const dataWithBadPrice = {
        ...translatedData,
        items: [{ ...translatedItems[0], unitPrice: -100 }],
      };

      const result = await service.normalizeData(
        dataWithBadPrice,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].unitPrice).toBe(0);
      expect(result.warnings.some((w) => w.includes('invalid unit price'))).toBe(true);
    });

    it('should default missing unit to "unit"', async () => {
      const dataWithNoUnit = {
        ...translatedData,
        items: [{ ...translatedItems[0], unit: '' }],
      };

      const result = await service.normalizeData(
        dataWithNoUnit,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].unit).toBe('unit');
    });

    it('should default currency to VND when not provided', async () => {
      const dataWithNoCurrency = {
        ...translatedData,
        items: [{ ...translatedItems[0], currency: undefined }],
      };

      const result = await service.normalizeData(
        dataWithNoCurrency,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.items[0].originalCurrency).toBe('VND');
    });

    it('should generate default title from vendorName when title is missing', async () => {
      const dataWithNoTitle = { ...translatedData, title: undefined };

      const result = await service.normalizeData(
        dataWithNoTitle,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.title).toContain('ABC Medical Supplies');
    });

    it('should generate fallback title when both title and vendorName are missing', async () => {
      const dataMinimal = { ...translatedData, title: undefined, vendorName: undefined };

      const result = await service.normalizeData(
        dataMinimal,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(result.title).toContain('vendor');
    });

    it('should save to checksum cache when org and job with checksum exist', async () => {
      const jobWithChecksum = makeJob({ fileChecksum: 'abc123checksum' });
      mockJobsRepo.findOne.mockResolvedValue(jobWithChecksum);
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());

      await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockChecksumCacheRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          checksum: 'abc123checksum',
          organizationId: ORG_ID,
        }),
      );
    });

    it('should not save to cache when organizationId or jobId is missing', async () => {
      await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        undefined, // no jobId
        ORG_ID,
      );

      expect(mockChecksumCacheRepo.save).not.toHaveBeenCalled();
    });

    it('should not save to cache when job has no fileChecksum', async () => {
      const jobWithNoChecksum = makeJob({ fileChecksum: null as any });
      mockJobsRepo.findOne.mockResolvedValue(jobWithNoChecksum);

      await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockChecksumCacheRepo.save).not.toHaveBeenCalled();
    });

    it('should scope product lookups by organizationId', async () => {
      await service.normalizeData(
        translatedData,
        undefined,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockProductsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('should scope customer lookups by organizationId', async () => {
      await service.normalizeData(
        translatedData,
        CUSTOMER_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockCustomersRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // FileChecksumCache deduplication (private helper behaviors via extract)
  // ---------------------------------------------------------------------------
  describe('FileChecksumCache deduplication', () => {
    it('should skip AI call and return cached data when checksum cache is valid', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());
      const cache = makeChecksumCache();
      mockChecksumCacheRepo.findOne.mockResolvedValue(cache);

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockAnthropicCreate).not.toHaveBeenCalled();
      expect(result.cacheHit).toBe(true);
    });

    it('should call AI when cache returns null (miss)', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());
      mockChecksumCacheRepo.findOne.mockResolvedValue(null);
      mockAnthropicCreate.mockResolvedValue(
        makeAiResponse({
          title: 'Fresh Result',
          vendorName: 'Vendor',
          items: [],
          notes: null,
          terms: null,
          confidence: 0.8,
          extractionWarnings: [],
        }),
      );

      const result = await service.extractFromDocument(
        ATTACHMENT_ID,
        EXECUTION_ID,
        JOB_ID,
        ORG_ID,
      );

      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
      expect(result.cacheHit).toBeUndefined();
    });

    it('should not check cache when organizationId is not provided', async () => {
      mockAttachmentsRepo.findOne.mockResolvedValue(makeAttachment());
      mockAnthropicCreate.mockResolvedValue(
        makeAiResponse({
          title: 'Result',
          vendorName: 'Vendor',
          items: [],
          notes: null,
          terms: null,
          confidence: 0.8,
          extractionWarnings: [],
        }),
      );

      await service.extractFromDocument(ATTACHMENT_ID, EXECUTION_ID, JOB_ID, undefined);

      expect(mockChecksumCacheRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
