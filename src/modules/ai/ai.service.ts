import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TokenTrackingService } from './token-tracking.service';
import { AiOperation } from '../../database/entities/token-usage.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic;

  constructor(
    private configService: ConfigService,
    private tokenTracking: TokenTrackingService,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    this.client = new Anthropic({ apiKey });
  }

  async generateQuotation(
    description: string,
    context?: { userId?: string; quotationId?: string },
  ) {
    const model = 'claude-sonnet-4-20250514';
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: `Ban la tro ly tao bao gia chuyen nghiep. Khi nguoi dung mo ta yeu cau, hay tao mot bao gia chi tiet voi cac hang muc cu the, don vi tinh, so luong va gia bang VND.

Tra ve ket qua dang JSON voi format sau:
{
  "title": "Tieu de bao gia",
  "items": [
    {
      "name": "Ten hang muc",
      "description": "Mo ta chi tiet",
      "unit": "Don vi tinh (goi/gio/thang/cai...)",
      "quantity": 1,
      "unitPrice": 10000000
    }
  ],
  "notes": "Ghi chu cho bao gia",
  "terms": "Dieu khoan thanh toan va dieu kien"
}

Luu y:
- Gia phai thuc te theo thi truong Viet Nam
- Tach cac hang muc chi tiet, khong gop chung
- Don vi tinh phu hop voi tung hang muc
- Them ghi chu va dieu khoan chuyen nghiep`,
        messages: [
          {
            role: 'user',
            content: `Hay tao bao gia cho yeu cau sau:\n\n${description}`,
          },
        ],
      });

      // Track token usage (fire-and-forget)
      this.tokenTracking.track({
        operation: AiOperation.GENERATE,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: context?.userId,
        quotationId: context?.quotationId,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `AI generation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async suggestItems(
    title: string,
    existingItems?: string[],
    context?: { userId?: string; quotationId?: string },
  ) {
    const model = 'claude-sonnet-4-20250514';
    try {
      const existingContext = existingItems?.length
        ? `\n\nCac hang muc da co: ${existingItems.join(', ')}`
        : '';

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: `Ban la tro ly tao bao gia. Khi nguoi dung cung cap tieu de bao gia, hay goi y cac hang muc phu hop.

Tra ve JSON array voi format:
[
  {
    "name": "Ten hang muc",
    "description": "Mo ta",
    "unit": "Don vi tinh",
    "quantity": 1,
    "unitPrice": 10000000
  }
]

Gia phai thuc te theo thi truong Viet Nam (VND). Khong lap lai hang muc da co.`,
        messages: [
          {
            role: 'user',
            content: `Goi y hang muc cho bao gia: "${title}"${existingContext}`,
          },
        ],
      });

      this.tokenTracking.track({
        operation: AiOperation.SUGGEST,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: context?.userId,
        quotationId: context?.quotationId,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `AI suggestion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async improveDescription(
    itemName: string,
    currentDescription: string,
    context?: { userId?: string; quotationId?: string },
  ) {
    const model = 'claude-sonnet-4-20250514';
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 1024,
        system: `Ban la tro ly viet noi dung chuyen nghiep cho bao gia. Hay cai thien mo ta hang muc de chuyen nghiep, chi tiet va thuyet phuc hon. Tra ve chi mo ta da cai thien, khong them gi khac.`,
        messages: [
          {
            role: 'user',
            content: `Cai thien mo ta cho hang muc "${itemName}":\n\nMo ta hien tai: ${currentDescription}`,
          },
        ],
      });

      this.tokenTracking.track({
        operation: AiOperation.IMPROVE,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: context?.userId,
        quotationId: context?.quotationId,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return { improvedDescription: content.text.trim() };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `AI improvement failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
