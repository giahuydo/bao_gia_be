import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Attachment } from '../../database/entities/attachment.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { TokenTrackingService } from '../ai/token-tracking.service';
import { AiOperation } from '../../database/entities/token-usage.entity';

/**
 * Handles the AI-powered vendor quotation ingestion pipeline.
 * Each method is a discrete step called by n8n via the IngestionController.
 *
 * Pipeline: extract → translate → normalize
 *
 * All Claude API calls happen here (not in n8n) so prompts are
 * version-controlled, testable, and token usage can be tracked.
 */
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
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    this.client = new Anthropic({ apiKey });
  }

  // ---------------------------------------------------------------------------
  // Step 1: Extract structured data from a vendor document
  // ---------------------------------------------------------------------------
  async extractFromDocument(
    attachmentId: string,
    executionId?: string,
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
  }> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    if (!fs.existsSync(attachment.filePath)) {
      throw new NotFoundException(
        `File not found on disk: ${attachment.filePath}`,
      );
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
      throw new BadRequestException(
        `Unsupported file type: ${attachment.mimeType}. Supported: ${supportedMimeTypes.join(', ')}`,
      );
    }

    const fileBuffer = fs.readFileSync(attachment.filePath);
    const base64Content = fileBuffer.toString('base64');

    this.logger.log(
      `Extracting from ${attachment.originalName} (${attachment.mimeType}) | executionId=${executionId || 'none'}`,
    );

    const isImage = attachment.mimeType.startsWith('image/');

    // Build content blocks based on file type
    // SDK v0.30 supports TextBlockParam and ImageBlockParam
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
      // PDF, DOCX, Text, CSV: extract text content and send as text block.
      // For PDFs: in production, use a proper PDF-to-text library (pdf-parse).
      // For now, send raw text for text-based files and base64 note for binary.
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

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: `You are a specialized document extraction AI for laboratory and medical equipment quotations.

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
      "currency": "USD"
    }
  ],
  "notes": "Any delivery, warranty, or general notes from the document",
  "terms": "Payment terms, validity period, etc."
}

Rules:
- Extract EVERY line item, do not skip any
- Keep original language for product names (do not translate)
- unitPrice must be a number (no currency symbols)
- Identify the currency from context (USD, EUR, VND, etc.)
- If quantity or price is unclear, use best estimate and note it in description
- If the document is not a quotation, return items as empty array and put explanation in notes`,
      messages: [{ role: 'user', content: userContent }],
    });

    const model = 'claude-sonnet-4-20250514';

    // Track token usage
    this.tokenTracking.track({
      operation: AiOperation.EXTRACT,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      n8nExecutionId: executionId,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new BadRequestException('Unexpected AI response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException(
        'Could not parse JSON from AI extraction response',
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);

    this.logger.log(
      `Extracted ${extracted.items?.length || 0} items | tokens: ${response.usage.input_tokens}/${response.usage.output_tokens}`,
    );

    return {
      title: extracted.title || null,
      vendorName: extracted.vendorName || null,
      items: extracted.items || [],
      notes: extracted.notes || null,
      terms: extracted.terms || null,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Step 2: Translate extracted data to Vietnamese
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
  }> {
    this.logger.log(
      `Translating ${extractedData.items.length} items to Vietnamese | executionId=${executionId || 'none'}`,
    );

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: `You are a professional translator specializing in laboratory and medical equipment terminology.
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
- Keep brand names untranslated`,
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
      model: 'claude-sonnet-4-20250514',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      n8nExecutionId: executionId,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new BadRequestException('Unexpected AI response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException(
        'Could not parse JSON from AI translation response',
      );
    }

    const translated = JSON.parse(jsonMatch[0]);

    this.logger.log(
      `Translation complete | tokens: ${response.usage.input_tokens}/${response.usage.output_tokens}`,
    );

    return {
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
    this.logger.log(
      `Normalizing ${translatedData.items.length} items | executionId=${executionId || 'none'}`,
    );

    const warnings: string[] = [];

    // Match customer if vendorName is provided and no customerId given
    let customerMatch: { id: string; name: string } | null = null;
    if (customerId) {
      const customer = await this.customersRepository.findOne({
        where: { id: customerId },
      });
      if (customer) {
        customerMatch = { id: customer.id, name: customer.name };
      } else {
        warnings.push(`Customer ID ${customerId} not found in database`);
      }
    } else if (translatedData.vendorName) {
      const customer = await this.customersRepository.findOne({
        where: { name: ILike(`%${translatedData.vendorName}%`) },
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

        // Try exact name match first
        const exactMatch = await this.productsRepository.findOne({
          where: { name: item.name, isActive: true },
        });

        if (exactMatch) {
          productId = exactMatch.id;
          matchConfidence = 'exact';
        } else {
          // Try fuzzy match (ILIKE)
          const fuzzyMatch = await this.productsRepository.findOne({
            where: { name: ILike(`%${item.name}%`), isActive: true },
          });
          if (fuzzyMatch) {
            productId = fuzzyMatch.id;
            matchConfidence = 'fuzzy';
            warnings.push(
              `Item #${index + 1} "${item.name}" fuzzy-matched to product "${fuzzyMatch.name}" (${fuzzyMatch.id})`,
            );
          }
        }

        // Validate numeric fields
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

    this.logger.log(
      `Normalization complete: ${normalizedItems.length} items, ${warnings.length} warnings`,
    );

    return {
      title,
      customerId: customerMatch?.id || null,
      customerMatch,
      items: normalizedItems,
      notes: translatedData.notes || null,
      terms: translatedData.terms || null,
      warnings,
    };
  }
}
