import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TokenUsage, AiOperation } from '../../database/entities/token-usage.entity';

/** Anthropic pricing per token (USD). Update when pricing changes. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
  },
  'claude-haiku-4-5-20251001': {
    input: 0.8 / 1_000_000,
    output: 4.0 / 1_000_000,
  },
};

const DEFAULT_PRICING = { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 };

export interface TrackTokenParams {
  operation: AiOperation;
  model: string;
  inputTokens: number;
  outputTokens: number;
  quotationId?: string;
  userId?: string;
  tenantId?: string;
  n8nExecutionId?: string;
  promptVersionId?: string;
}

export interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  byOperation: Record<
    string,
    {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      costUsd: number;
    }
  >;
  byModel: Record<
    string,
    {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      costUsd: number;
    }
  >;
}

@Injectable()
export class TokenTrackingService {
  private readonly logger = new Logger(TokenTrackingService.name);

  constructor(
    @InjectRepository(TokenUsage)
    private tokenUsageRepository: Repository<TokenUsage>,
  ) {}

  /**
   * Record a single Claude API call's token usage.
   * Fire-and-forget — errors are logged but do not propagate to callers.
   */
  async track(params: TrackTokenParams): Promise<TokenUsage> {
    const pricing = MODEL_PRICING[params.model] || DEFAULT_PRICING;
    const costUsd =
      params.inputTokens * pricing.input +
      params.outputTokens * pricing.output;
    const totalTokens = params.inputTokens + params.outputTokens;

    const record = this.tokenUsageRepository.create({
      operation: params.operation,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      costUsd,
      quotationId: params.quotationId,
      userId: params.userId,
      tenantId: params.tenantId,
      n8nExecutionId: params.n8nExecutionId,
      promptVersionId: params.promptVersionId,
    });

    try {
      const saved = await this.tokenUsageRepository.save(record);
      this.logger.log(
        `Token usage tracked | op=${params.operation} model=${params.model} ` +
          `in=${params.inputTokens} out=${params.outputTokens} cost=$${costUsd.toFixed(4)}`,
      );
      return saved;
    } catch (error) {
      // Never let tracking failure break the main flow
      this.logger.error(`Failed to track token usage: ${error.message}`);
      return record;
    }
  }

  /**
   * Query aggregated usage within a date range.
   */
  async getUsageSummary(filters: {
    from?: string; // ISO date string
    to?: string;
    userId?: string;
    tenantId?: string;
    quotationId?: string;
  }): Promise<UsageSummary> {
    const where: any = {};

    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    } else if (filters.from) {
      where.createdAt = MoreThanOrEqual(new Date(filters.from));
    } else if (filters.to) {
      where.createdAt = LessThanOrEqual(new Date(filters.to));
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.quotationId) where.quotationId = filters.quotationId;

    const records = await this.tokenUsageRepository.find({ where });

    const summary: UsageSummary = {
      totalRequests: records.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      byOperation: {},
      byModel: {},
    };

    for (const r of records) {
      const inputTokens = Number(r.inputTokens);
      const outputTokens = Number(r.outputTokens);
      const totalTokens = Number(r.totalTokens);
      const costUsd = Number(r.costUsd);

      summary.totalInputTokens += inputTokens;
      summary.totalOutputTokens += outputTokens;
      summary.totalTokens += totalTokens;
      summary.totalCostUsd += costUsd;

      // By operation
      if (!summary.byOperation[r.operation]) {
        summary.byOperation[r.operation] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
        };
      }
      const opBucket = summary.byOperation[r.operation];
      opBucket.requests++;
      opBucket.inputTokens += inputTokens;
      opBucket.outputTokens += outputTokens;
      opBucket.totalTokens += totalTokens;
      opBucket.costUsd += costUsd;

      // By model
      if (!summary.byModel[r.model]) {
        summary.byModel[r.model] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
        };
      }
      const modelBucket = summary.byModel[r.model];
      modelBucket.requests++;
      modelBucket.inputTokens += inputTokens;
      modelBucket.outputTokens += outputTokens;
      modelBucket.totalTokens += totalTokens;
      modelBucket.costUsd += costUsd;
    }

    // Round cost totals
    summary.totalCostUsd = parseFloat(summary.totalCostUsd.toFixed(6));
    for (const bucket of [
      ...Object.values(summary.byOperation),
      ...Object.values(summary.byModel),
    ]) {
      bucket.costUsd = parseFloat(bucket.costUsd.toFixed(6));
    }

    return summary;
  }

  /**
   * Get detailed per-request records with pagination.
   */
  async getUsageRecords(filters: {
    from?: string;
    to?: string;
    userId?: string;
    tenantId?: string;
    quotationId?: string;
    operation?: AiOperation;
    page?: number;
    limit?: number;
  }): Promise<{ data: TokenUsage[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const where: any = {};

    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    } else if (filters.from) {
      where.createdAt = MoreThanOrEqual(new Date(filters.from));
    } else if (filters.to) {
      where.createdAt = LessThanOrEqual(new Date(filters.to));
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.quotationId) where.quotationId = filters.quotationId;
    if (filters.operation) where.operation = filters.operation;

    const [data, total] = await this.tokenUsageRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
