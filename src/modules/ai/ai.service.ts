import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { TokenTrackingService } from './token-tracking.service';
import { AiOperation, TokenUsage } from '../../database/entities/token-usage.entity';
import { Organization } from '../../database/entities/organization.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic;

  constructor(
    private configService: ConfigService,
    private tokenTracking: TokenTrackingService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(TokenUsage)
    private tokenUsageRepository: Repository<TokenUsage>,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    this.client = new Anthropic({ apiKey });
  }

  async checkBudget(organizationId: string): Promise<void> {
    if (!organizationId) return;
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.tokenUsageRepository
      .createQueryBuilder('tu')
      .select('COALESCE(SUM(tu.total_tokens), 0)', 'totalTokens')
      .where('tu.tenant_id = :orgId', { orgId: organizationId })
      .andWhere('tu.created_at >= :start', { start: startOfMonth })
      .getRawOne();

    const used = parseInt(result.totalTokens, 10);
    if (used >= org.monthlyTokenLimit) {
      throw new HttpException(
        `Monthly token limit exceeded (${used}/${org.monthlyTokenLimit}). Upgrade your plan or wait until next month.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
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

  async compare(
    vendorSpec: { items: any[] },
    customerRequirement: { items: any[]; budget?: number },
    context?: { userId?: string; quotationId?: string; organizationId?: string },
  ) {
    if (context?.organizationId) {
      await this.checkBudget(context.organizationId);
    }

    const model = 'claude-sonnet-4-20250514';
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 8192,
        system: `You are an expert procurement comparison assistant. Compare vendor offerings against customer requirements.

Return ONLY valid JSON with this structure:
{
  "matches": [
    {
      "vendorItemIndex": 0,
      "requirementItemIndex": 0,
      "matchScore": 0.85,
      "matchReason": "Why these items match",
      "priceAssessment": "competitive|expensive|cheap",
      "specComparison": {
        "met": ["spec1", "spec2"],
        "unmet": ["spec3"],
        "exceeded": ["spec4"]
      },
      "gaps": ["Missing feature X"],
      "suggestions": ["Consider alternative Y"]
    }
  ],
  "unmatchedVendorItems": [0, 2],
  "unmatchedRequirements": [3],
  "overallScore": 0.75,
  "summary": "Brief overall assessment",
  "budgetAnalysis": {
    "totalVendorCost": 500000000,
    "budget": 600000000,
    "withinBudget": true,
    "savings": 100000000
  }
}

Rules:
- matchScore is 0-1 (0 = no match, 1 = perfect match)
- NEVER invent specs not in the data
- Be precise about what is met vs unmet
- Budget analysis only if budget is provided`,
        messages: [
          {
            role: 'user',
            content: `Compare these vendor items against customer requirements:

VENDOR ITEMS:
${JSON.stringify(vendorSpec.items, null, 2)}

CUSTOMER REQUIREMENTS:
${JSON.stringify(customerRequirement.items, null, 2)}
${customerRequirement.budget ? `\nBUDGET: ${customerRequirement.budget}` : ''}`,
          },
        ],
      });

      this.tokenTracking.track({
        operation: AiOperation.COMPARE,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: context?.userId,
        quotationId: context?.quotationId,
        tenantId: context?.organizationId,
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
        `AI comparison failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDashboard(
    organizationId: string,
    filters: { from?: string; to?: string; groupBy?: string },
  ) {
    const where: any = { tenantId: organizationId };

    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    } else if (filters.from) {
      where.createdAt = MoreThanOrEqual(new Date(filters.from));
    } else if (filters.to) {
      where.createdAt = LessThanOrEqual(new Date(filters.to));
    }

    const records = await this.tokenUsageRepository.find({ where, order: { createdAt: 'ASC' } });

    // Summary
    let totalTokens = 0;
    let totalCost = 0;
    const byOperation: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byUser: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const timeSeriesMap: Record<string, { date: string; tokens: number; cost: number; requests: number }> = {};

    const groupBy = filters.groupBy || 'day';

    for (const r of records) {
      const tokens = Number(r.totalTokens);
      const cost = Number(r.costUsd);
      totalTokens += tokens;
      totalCost += cost;

      // By operation
      if (!byOperation[r.operation]) {
        byOperation[r.operation] = { requests: 0, tokens: 0, cost: 0 };
      }
      byOperation[r.operation].requests++;
      byOperation[r.operation].tokens += tokens;
      byOperation[r.operation].cost += cost;

      // By user
      const userId = r.userId || 'system';
      if (!byUser[userId]) {
        byUser[userId] = { requests: 0, tokens: 0, cost: 0 };
      }
      byUser[userId].requests++;
      byUser[userId].tokens += tokens;
      byUser[userId].cost += cost;

      // Time series
      let dateKey: string;
      const d = new Date(r.createdAt);
      if (groupBy === 'month') {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        dateKey = d.toISOString().split('T')[0];
      }

      if (!timeSeriesMap[dateKey]) {
        timeSeriesMap[dateKey] = { date: dateKey, tokens: 0, cost: 0, requests: 0 };
      }
      timeSeriesMap[dateKey].tokens += tokens;
      timeSeriesMap[dateKey].cost += cost;
      timeSeriesMap[dateKey].requests++;
    }

    // Budget alert
    const org = organizationId
      ? await this.organizationRepository.findOne({ where: { id: organizationId } })
      : null;
    const budgetAlert = org
      ? {
          limit: org.monthlyTokenLimit,
          used: totalTokens,
          remaining: Math.max(0, org.monthlyTokenLimit - totalTokens),
          percentUsed: parseFloat(((totalTokens / org.monthlyTokenLimit) * 100).toFixed(1)),
        }
      : null;

    return {
      summary: {
        totalRequests: records.length,
        totalTokens,
        totalCost: parseFloat(totalCost.toFixed(6)),
      },
      timeSeries: Object.values(timeSeriesMap),
      byOperation,
      byUser: Object.entries(byUser).map(([userId, data]) => ({ userId, ...data })),
      budgetAlert,
    };
  }
}
