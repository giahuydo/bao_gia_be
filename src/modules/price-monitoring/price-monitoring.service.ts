import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PriceMonitoringJob,
  PriceMonitoringJobStatus,
  PriceMonitoringTriggerType,
} from '../../database/entities/price-monitoring-job.entity';
import { PriceRecord } from '../../database/entities/price-record.entity';
import { PriceAlert, PriceAlertSeverity } from '../../database/entities/price-alert.entity';
import { N8nTriggerService } from '../../common/services/n8n-trigger.service';
import { TriggerMonitoringDto } from './dto/trigger-monitoring.dto';
import { PriceMonitoringQueryDto, PriceAlertQueryDto } from './dto/price-monitoring-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceMonitoringCallbackDto } from './dto/price-monitoring-callback.dto';

const PRICE_CHANGE_THRESHOLDS = {
  INFO: 5,
  WARNING: 15,
  CRITICAL: 30,
} as const;

@Injectable()
export class PriceMonitoringService {
  private readonly logger = new Logger(PriceMonitoringService.name);

  constructor(
    @InjectRepository(PriceMonitoringJob)
    private jobRepository: Repository<PriceMonitoringJob>,
    @InjectRepository(PriceRecord)
    private priceRecordRepository: Repository<PriceRecord>,
    @InjectRepository(PriceAlert)
    private priceAlertRepository: Repository<PriceAlert>,
    private n8nTriggerService: N8nTriggerService,
  ) {}

  async triggerMonitoring(dto: TriggerMonitoringDto, userId: string, orgId: string) {
    const job = this.jobRepository.create({
      organizationId: orgId,
      status: PriceMonitoringJobStatus.PENDING,
      triggerType: PriceMonitoringTriggerType.MANUAL,
      triggeredBy: userId,
      totalProducts: dto.productIds?.length ?? 0,
    });
    const savedJob = await this.jobRepository.save(job);

    const triggerResult = await this.n8nTriggerService.triggerWorkflow('price-monitoring', {
      jobId: savedJob.id,
      organizationId: orgId,
      productIds: dto.productIds ?? [],
      triggeredBy: userId,
    });

    if (triggerResult.success) {
      savedJob.status = PriceMonitoringJobStatus.RUNNING;
      savedJob.n8nExecutionId = triggerResult.executionId ?? null;
      savedJob.startedAt = new Date();
    } else {
      savedJob.status = PriceMonitoringJobStatus.FAILED;
      savedJob.error = triggerResult.error ?? null;
      this.logger.error(`Failed to trigger price monitoring job ${savedJob.id}: ${triggerResult.error}`);
    }

    return this.jobRepository.save(savedJob);
  }

  async handleCallback(dto: PriceMonitoringCallbackDto) {
    const job = await this.jobRepository.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException(`Price monitoring job ${dto.jobId} not found`);
    }

    const alerts: PriceAlert[] = [];

    if (dto.results && dto.results.length > 0) {
      const records = dto.results.map((result) => {
        const priceChange = result.currentPrice - result.previousPrice;
        const priceChangePercent =
          result.previousPrice !== 0
            ? (priceChange / result.previousPrice) * 100
            : 0;

        return this.priceRecordRepository.create({
          jobId: job.id,
          productId: result.productId,
          productName: result.productName,
          previousPrice: result.previousPrice,
          currentPrice: result.currentPrice,
          priceChange,
          priceChangePercent,
          currencyCode: result.currencyCode ?? 'VND',
          source: result.source,
          fetchedAt: new Date(result.fetchedAt),
        });
      });

      await this.priceRecordRepository.save(records);

      // Generate alerts based on thresholds
      for (const result of dto.results) {
        const priceChange = result.currentPrice - result.previousPrice;
        const priceChangePercent =
          result.previousPrice !== 0
            ? (priceChange / result.previousPrice) * 100
            : 0;

        const absPercent = Math.abs(priceChangePercent);
        let severity: PriceAlertSeverity | null = null;

        if (absPercent >= PRICE_CHANGE_THRESHOLDS.CRITICAL) {
          severity = PriceAlertSeverity.CRITICAL;
        } else if (absPercent >= PRICE_CHANGE_THRESHOLDS.WARNING) {
          severity = PriceAlertSeverity.WARNING;
        } else if (absPercent >= PRICE_CHANGE_THRESHOLDS.INFO) {
          severity = PriceAlertSeverity.INFO;
        }

        if (severity) {
          const direction = priceChange >= 0 ? 'increased' : 'decreased';
          const alert = this.priceAlertRepository.create({
            organizationId: job.organizationId,
            jobId: job.id,
            productId: result.productId,
            productName: result.productName,
            severity,
            previousPrice: result.previousPrice,
            currentPrice: result.currentPrice,
            priceChangePercent,
            message: `Price of "${result.productName}" has ${direction} by ${Math.abs(priceChangePercent).toFixed(2)}% (${result.previousPrice} -> ${result.currentPrice} ${result.currencyCode ?? 'VND'})`,
          });
          alerts.push(alert);
        }
      }

      if (alerts.length > 0) {
        await this.priceAlertRepository.save(alerts);
      }
    }

    const statusMap: Record<string, PriceMonitoringJobStatus> = {
      completed: PriceMonitoringJobStatus.COMPLETED,
      failed: PriceMonitoringJobStatus.FAILED,
      partial: PriceMonitoringJobStatus.PARTIAL,
    };

    job.status = statusMap[dto.status] ?? PriceMonitoringJobStatus.FAILED;
    job.processedProducts = dto.results?.length ?? 0;
    job.alertCount = alerts.length;
    job.completedAt = new Date();

    if (dto.error) {
      job.error = dto.error ?? null;
    }

    await this.jobRepository.save(job);

    return { received: true, alertsGenerated: alerts.length };
  }

  async findAllJobs(query: PriceMonitoringQueryDto, orgId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = { organizationId: orgId };

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.jobRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findJobById(id: string, orgId: string) {
    const job = await this.jobRepository.findOne({
      where: { id, organizationId: orgId },
      relations: ['organization'],
    });
    if (!job) {
      throw new NotFoundException(`Price monitoring job ${id} not found`);
    }

    const records = await this.priceRecordRepository.find({
      where: { jobId: id },
      order: { createdAt: 'DESC' },
    });

    return { ...job, priceRecords: records };
  }

  async getPriceHistory(query: PriceHistoryQueryDto, orgId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.priceRecordRepository
      .createQueryBuilder('pr')
      .innerJoin('pr.job', 'job')
      .where('job.organization_id = :orgId', { orgId })
      .andWhere('pr.product_id = :productId', { productId: query.productId })
      .orderBy('pr.fetched_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.from) {
      qb.andWhere('pr.fetched_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('pr.fetched_at <= :to', { to: new Date(query.to) });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findAlerts(query: PriceAlertQueryDto, orgId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = { organizationId: orgId };

    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.unreadOnly) {
      where.isRead = false;
    }

    const [data, total] = await this.priceAlertRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async markAlertRead(id: string, orgId: string) {
    const alert = await this.priceAlertRepository.findOne({
      where: { id, organizationId: orgId },
    });
    if (!alert) {
      throw new NotFoundException(`Price alert ${id} not found`);
    }
    alert.isRead = true;
    return this.priceAlertRepository.save(alert);
  }

  async markAllAlertsRead(orgId: string) {
    await this.priceAlertRepository.update(
      { organizationId: orgId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }
}
