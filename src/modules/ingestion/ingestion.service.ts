import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThan } from 'typeorm';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Attachment } from '../../database/entities/attachment.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { IngestionJob, JobStatus } from '../../database/entities/ingestion-job.entity';
import { FileChecksumCache } from '../../database/entities/file-checksum-cache.entity';
import { GlossaryTerm } from '../../database/entities/glossary-term.entity';
import { AiPromptVersion, PromptType } from '../../database/entities/ai-prompt-version.entity';
import { TokenTrackingService } from '../ai/token-tracking.service';
import { AiOperation } from '../../database/entities/token-usage.entity';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private client: Anthropic;

  constructor(
    private configService: ConfigService,
    private tokenTracking: TokenTrackingService,
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(IngestionJob)
    private jobsRepository: Repository<IngestionJob>,
    @InjectRepository(FileChecksumCache)
    private checksumCacheRepository: Repository<FileChecksumCache>,
    @InjectRepository(GlossaryTerm)
    private glossaryRepository: Repository<GlossaryTerm>,
    @InjectRepository(AiPromptVersion)
    private promptVersionRepository: Repository<AiPromptVersion>,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    this.client = new Anthropic({ apiKey });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computeChecksum(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async getActivePrompt(type: PromptType): Promise<AiPromptVersion | null> {
    return this.promptVersionRepository.findOne({
      where: { type, isActive: true },
    });
  }

  private async getGlossary(organizationId: string, category?: string): Promise<GlossaryTerm[]> {
    const where: any = { organizationId };
    if (category) where.category = category;
    return this.glossaryRepository.find({ where });
  }

  private buildGlossaryPromptSection(terms: GlossaryTerm[]): string {
    if (!terms.length) return '';
    const termLines = terms
      .map((t) => `- "${t.sourceTerm}" → "${t.targetTerm}"`)
      .join('\n');
    return `\n\nUse these EXACT translations (glossary):\n${termLines}\n`;
  }

  private async checkCacheHit(
    checksum: string,
    organizationId: string,
  ): Promise<FileChecksumCache | null> {
    const cached = await this.checksumCacheRepository.findOne({
      where: {
        checksum,
        organizationId,
        expiresAt: MoreThan(new Date()),
      },
    });
    if (cached) {
      // Update hit count
      await this.checksumCacheRepository.update(cached.id, {
        hitCount: cached.hitCount + 1,
        lastHitAt: new Date(),
      });
    }
    return cached;
  }

  private async saveToCache(
    checksum: string,
    organizationId: string,
    attachment: Attachment,
    extractResult: any,
    translateResult: any,
    promptVersionId?: string,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day TTL

    await this.checksumCacheRepository.save({
      checksum,
      organizationId,
      originalFileName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      extractResult,
      translateResult,
      promptVersionId,
      expiresAt,
    });
  }

  private async updateJobStatus(
    jobId: string | undefined,
    status: JobStatus,
    data?: Partial<IngestionJob>,
  ): Promise<void> {
    if (!jobId) return;
    const update: any = { status, ...data };
    if (status === JobStatus.EXTRACTING || status === JobStatus.TRANSLATING || status === JobStatus.NORMALIZING) {
      update.currentStep = status;
    }
    if (status === JobStatus.EXTRACTING && !data?.startedAt) {
      update.startedAt = new Date();
    }
    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED || status === JobStatus.DEAD_LETTER) {
      update.completedAt = new Date();
    }
    await this.jobsRepository.update(jobId, update);
  }

  // ---------------------------------------------------------------------------
  // Step 1: Extract structured data from a vendor document
  // ---------------------------------------------------------------------------
  async extractFromDocument(
    attachmentId: string,
    executionId?: string,
    jobId?: string,
    organizationId?: string,
  ): Promise<{
    title: string | null;
    vendorName: string | null;
    items: Array<{
      name: string;
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      currency: string;
      catalogNumber?: string;
      category?: string;
    }>;
    notes: string | null;
    terms: string | null;
    confidence?: number;
    extractionWarnings?: string[];
    tokenUsage: { inputTokens: number; outputTokens: number };
    cacheHit?: boolean;
  }> {
    await this.updateJobStatus(jobId, JobStatus.EXTRACTING);

    const attachment = await this.attachmentsRepository.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      await this.updateJobStatus(jobId, JobStatus.FAILED, { error: `Attachment ${attachmentId} not found` });
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    if (!fs.existsSync(attachment.filePath)) {
      await this.updateJobStatus(jobId, JobStatus.FAILED, { error: `File not found on disk` });
      throw new NotFoundException(`File not found on disk: ${attachment.filePath}`);
    }

    // File checksum cache check
    if (organizationId) {
      const checksum = this.computeChecksum(attachment.filePath);
      if (jobId) {
        await this.jobsRepository.update(jobId, { fileChecksum: checksum });
      }

      const cached = await this.checkCacheHit(checksum, organizationId);
      if (cached?.extractResult) {
        this.logger.log(`Cache HIT for ${attachment.originalName} (checksum: ${checksum})`);
        await this.updateJobStatus(jobId, JobStatus.EXTRACTING, { extractResult: cached.extractResult });
        const cachedResult = cached.extractResult as any;
        return {
          title: cachedResult.title || null,
          vendorName: cachedResult.vendorName || null,
          items: cachedResult.items || [],
          notes: cachedResult.notes || null,
          terms: cachedResult.terms || null,
          confidence: cachedResult.confidence,
          extractionWarnings: cachedResult.extractionWarnings || [],
          cacheHit: true,
          tokenUsage: { inputTokens: 0, outputTokens: 0 },
        };
      }
    }

    const supportedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
    ];

    if (!supportedMimeTypes.includes(attachment.mimeType)) {
      await this.updateJobStatus(jobId, JobStatus.FAILED, { error: `Unsupported file type: ${attachment.mimeType}` });
      throw new BadRequestException(
        `Unsupported file type: ${attachment.mimeType}. Supported: ${supportedMimeTypes.join(', ')}`,
      );
    }

    const fileBuffer = fs.readFileSync(attachment.filePath);
    const base64Content = fileBuffer.toString('base64');

    this.logger.log(
      `Extracting from ${attachment.originalName} (${attachment.mimeType}) | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    const isImage = attachment.mimeType.startsWith('image/');

    const userContent: Array<
      Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
    > = [];

    if (isImage) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType as 'image/png' | 'image/jpeg',
          data: base64Content,
        },
      });
    } else {
      const textContent = fileBuffer.toString('utf-8');
      userContent.push({
        type: 'text',
        text: `Document content (file: ${attachment.originalName}):\n\n${textContent}`,
      });
    }

    userContent.push({
      type: 'text',
      text: 'Extract all quotation items from this vendor document. Follow the JSON format specified in the system prompt exactly.',
    });

    // Load active prompt version or use default
    const promptVersion = await this.getActivePrompt(PromptType.EXTRACT);
    const model = promptVersion?.model || 'claude-sonnet-4-20250514';
    const maxTokens = promptVersion?.maxTokens || 8192;
    const systemPrompt = promptVersion?.systemPrompt || `You are a specialized document extraction AI for laboratory and medical equipment quotations.

Given a vendor quotation document (PDF, image, or text), extract ALL line items into structured JSON.

Return ONLY valid JSON in this exact format:
{
  "title": "Vendor quotation title or reference number, or null",
  "vendorName": "Vendor/supplier company name, or null",
  "items": [
    {
      "name": "Product/equipment name in original language",
      "description": "Technical specifications and details",
      "unit": "Unit of measure (unit, set, box, piece, etc.)",
      "quantity": 1,
      "unitPrice": 15000.00,
      "currency": "USD",
      "catalogNumber": "Model/catalog number if available",
      "category": "lab|biotech|icu|analytical|general"
    }
  ],
  "notes": "Any delivery, warranty, or general notes from the document",
  "terms": "Payment terms, validity period, etc.",
  "confidence": 0.9,
  "extractionWarnings": ["Any issues encountered during extraction"]
}

Rules:
- Extract EVERY line item, do not skip any
- NEVER invent items not in the document
- Keep original language for product names (do not translate)
- unitPrice must be a number (no currency symbols)
- Set null with warning if data is unclear (do not guess)
- Classify each item into category (lab/biotech/icu/analytical/general)
- Set confidence 0-1 based on extraction quality`;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    // Track token usage
    this.tokenTracking.track({
      operation: AiOperation.EXTRACT,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      n8nExecutionId: executionId,
      tenantId: organizationId,
      promptVersionId: promptVersion?.id,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new BadRequestException('Unexpected AI response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException('Could not parse JSON from AI extraction response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Post-AI guardrails
    const warnings = extracted.extractionWarnings || [];
    if (extracted.items) {
      for (const item of extracted.items) {
        if (item.unitPrice === null && !warnings.some((w: string) => w.includes(item.name))) {
          warnings.push(`Item "${item.name}" has null price — flagged for review`);
        }
        if (item.unitPrice > 10_000_000) {
          warnings.push(`Item "${item.name}" has unusually high price: ${item.unitPrice}`);
        }
        if (item.quantity > 10_000) {
          warnings.push(`Item "${item.name}" has unusually high quantity: ${item.quantity}`);
        }
      }
    }

    const result = {
      title: extracted.title || null,
      vendorName: extracted.vendorName || null,
      items: extracted.items || [],
      notes: extracted.notes || null,
      terms: extracted.terms || null,
      confidence: extracted.confidence,
      extractionWarnings: warnings,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };

    // Update job with extract result
    await this.updateJobStatus(jobId, JobStatus.EXTRACTING, { extractResult: result });

    this.logger.log(
      `Extracted ${result.items.length} items | tokens: ${response.usage.input_tokens}/${response.usage.output_tokens}`,
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Step 2: Translate extracted data to Vietnamese (with glossary injection)
  // ---------------------------------------------------------------------------
  async translateToVietnamese(
    extractedData: {
      title?: string;
      vendorName?: string;
      items: Array<{
        name: string;
        description?: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        currency?: string;
      }>;
      notes?: string;
      terms?: string;
    },
    executionId?: string,
    jobId?: string,
    organizationId?: string,
  ): Promise<{
    title: string | null;
    vendorName: string | null;
    items: Array<{
      name: string;
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      currency: string;
    }>;
    notes: string | null;
    terms: string | null;
    tokenUsage: { inputTokens: number; outputTokens: number };
    cacheHit?: boolean;
  }> {
    await this.updateJobStatus(jobId, JobStatus.TRANSLATING);

    this.logger.log(
      `Translating ${extractedData.items.length} items to Vietnamese | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    // Load glossary for organization
    const glossaryTerms = organizationId
      ? await this.getGlossary(organizationId)
      : [];
    const glossarySection = this.buildGlossaryPromptSection(glossaryTerms);

    // Load active prompt version or use default
    const promptVersion = await this.getActivePrompt(PromptType.TRANSLATE);
    const model = promptVersion?.model || 'claude-sonnet-4-20250514';
    const maxTokens = promptVersion?.maxTokens || 8192;
    const systemPrompt = (promptVersion?.systemPrompt || `You are a professional translator specializing in laboratory and medical equipment terminology.
Translate the given quotation data from its original language to Vietnamese.

Return ONLY valid JSON in the same structure as the input:
{
  "title": "Translated title",
  "vendorName": "Translated or kept vendor name",
  "items": [
    {
      "name": "Vietnamese product name",
      "description": "Vietnamese description with technical specs preserved",
      "unit": "Vietnamese unit (cai, bo, hop, chiec, etc.)",
      "quantity": 1,
      "unitPrice": 15000.00,
      "currency": "USD"
    }
  ],
  "notes": "Translated notes",
  "terms": "Translated terms"
}

Rules:
- Translate product names to Vietnamese but keep model numbers/codes intact
- Keep technical specifications (dimensions, power, etc.) in original format
- Translate units to Vietnamese equivalents (unit→cai, set→bo, box→hop, piece→chiec)
- Do NOT change numeric values (quantity, unitPrice)
- Do NOT change currency codes
- If text is already in Vietnamese, keep it as-is
- Keep brand names untranslated`) + glossarySection;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Translate this quotation data to Vietnamese:\n\n${JSON.stringify(extractedData, null, 2)}`,
        },
      ],
    });

    // Track token usage
    this.tokenTracking.track({
      operation: AiOperation.TRANSLATE,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      n8nExecutionId: executionId,
      tenantId: organizationId,
      promptVersionId: promptVersion?.id,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new BadRequestException('Unexpected AI response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException('Could not parse JSON from AI translation response');
    }

    const translated = JSON.parse(jsonMatch[0]);

    const result = {
      title: translated.title || null,
      vendorName: translated.vendorName || null,
      items: translated.items || [],
      notes: translated.notes || null,
      terms: translated.terms || null,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };

    // Update job with translate result
    await this.updateJobStatus(jobId, JobStatus.TRANSLATING, { translateResult: result });

    this.logger.log(
      `Translation complete | tokens: ${response.usage.input_tokens}/${response.usage.output_tokens}`,
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Step 3: Normalize data — match products, validate, convert currency
  // ---------------------------------------------------------------------------
  async normalizeData(
    translatedData: {
      title?: string;
      vendorName?: string;
      items: Array<{
        name: string;
        description?: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        currency?: string;
      }>;
      notes?: string;
      terms?: string;
    },
    customerId?: string,
    executionId?: string,
    jobId?: string,
    organizationId?: string,
  ): Promise<{
    title: string;
    customerId: string | null;
    customerMatch: { id: string; name: string } | null;
    items: Array<{
      productId: string | null;
      name: string;
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      matchConfidence: 'exact' | 'fuzzy' | 'none';
      originalCurrency: string;
    }>;
    notes: string | null;
    terms: string | null;
    warnings: string[];
  }> {
    await this.updateJobStatus(jobId, JobStatus.NORMALIZING);

    this.logger.log(
      `Normalizing ${translatedData.items.length} items | executionId=${executionId || 'none'} | jobId=${jobId || 'none'}`,
    );

    const warnings: string[] = [];

    // Scope customer/product queries by organization if available
    const orgFilter: any = organizationId ? { organizationId } : {};

    // Match customer
    let customerMatch: { id: string; name: string } | null = null;
    if (customerId) {
      const customer = await this.customersRepository.findOne({
        where: { id: customerId, ...orgFilter },
      });
      if (customer) {
        customerMatch = { id: customer.id, name: customer.name };
      } else {
        warnings.push(`Customer ID ${customerId} not found in database`);
      }
    } else if (translatedData.vendorName) {
      const customer = await this.customersRepository.findOne({
        where: { name: ILike(`%${translatedData.vendorName}%`), ...orgFilter },
      });
      if (customer) {
        customerMatch = { id: customer.id, name: customer.name };
      } else {
        warnings.push(
          `No customer match found for vendor "${translatedData.vendorName}". Quotation will be created without customer link.`,
        );
      }
    }

    // Match each item against the product catalog
    const normalizedItems = await Promise.all(
      translatedData.items.map(async (item, index) => {
        let productId: string | null = null;
        let matchConfidence: 'exact' | 'fuzzy' | 'none' = 'none';

        const productFilter = { ...orgFilter, isActive: true };

        const exactMatch = await this.productsRepository.findOne({
          where: { name: item.name, ...productFilter },
        });

        if (exactMatch) {
          productId = exactMatch.id;
          matchConfidence = 'exact';
        } else {
          const fuzzyMatch = await this.productsRepository.findOne({
            where: { name: ILike(`%${item.name}%`), ...productFilter },
          });
          if (fuzzyMatch) {
            productId = fuzzyMatch.id;
            matchConfidence = 'fuzzy';
            warnings.push(
              `Item #${index + 1} "${item.name}" fuzzy-matched to product "${fuzzyMatch.name}" (${fuzzyMatch.id})`,
            );
          }
        }

        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        if (isNaN(quantity) || quantity <= 0) {
          warnings.push(
            `Item #${index + 1} "${item.name}" has invalid quantity: ${item.quantity}. Defaulting to 1.`,
          );
        }
        if (isNaN(unitPrice) || unitPrice < 0) {
          warnings.push(
            `Item #${index + 1} "${item.name}" has invalid unit price: ${item.unitPrice}. Defaulting to 0.`,
          );
        }

        return {
          productId,
          name: item.name,
          description: item.description || '',
          unit: item.unit || 'cai',
          quantity: isNaN(quantity) || quantity <= 0 ? 1 : quantity,
          unitPrice: isNaN(unitPrice) || unitPrice < 0 ? 0 : unitPrice,
          matchConfidence,
          originalCurrency: item.currency || 'VND',
        };
      }),
    );

    const title =
      translatedData.title ||
      `Bao gia tu ${translatedData.vendorName || 'nha cung cap'}`;

    const result = {
      title,
      customerId: customerMatch?.id || null,
      customerMatch,
      items: normalizedItems,
      notes: translatedData.notes || null,
      terms: translatedData.terms || null,
      warnings,
    };

    // Update job with normalize result
    await this.updateJobStatus(jobId, JobStatus.NORMALIZING, { normalizeResult: result });

    // Save to checksum cache if we have org context
    if (organizationId && jobId) {
      const job = await this.jobsRepository.findOne({ where: { id: jobId } });
      if (job?.fileChecksum) {
        const attachment = await this.attachmentsRepository.findOne({
          where: { id: job.attachmentId },
        });
        if (attachment) {
          await this.saveToCache(
            job.fileChecksum,
            organizationId,
            attachment,
            job.extractResult,
            job.translateResult,
            job.promptVersionId,
          );
        }
      }
    }

    this.logger.log(
      `Normalization complete: ${normalizedItems.length} items, ${warnings.length} warnings`,
    );

    return result;
  }
}
