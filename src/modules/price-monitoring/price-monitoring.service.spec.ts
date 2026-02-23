import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PriceMonitoringService } from './price-monitoring.service';
import { PriceMonitoringJob, PriceMonitoringJobStatus, PriceMonitoringTriggerType } from '../../database/entities/price-monitoring-job.entity';
import { PriceRecord } from '../../database/entities/price-record.entity';
import { PriceAlert, PriceAlertSeverity } from '../../database/entities/price-alert.entity';
import { N8nTriggerService } from '../../common/services/n8n-trigger.service';

describe('PriceMonitoringService', () => {
  let service: PriceMonitoringService;
  let mockJobRepo: Record<string, jest.Mock>;
  let mockRecordRepo: Record<string, jest.Mock>;
  let mockAlertRepo: Record<string, jest.Mock>;
  let mockN8nTrigger: Partial<N8nTriggerService>;

  const mockOrgId = 'org-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockJobId = 'job-uuid-1';

  beforeEach(async () => {
    mockJobRepo = {
      create: jest.fn((data) => ({ id: mockJobId, ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: mockJobId, ...entity })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };
    mockRecordRepo = {
      create: jest.fn((data) => ({ id: 'record-1', ...data })),
      save: jest.fn((entities) =>
        Promise.resolve(Array.isArray(entities) ? entities : [entities]),
      ),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockAlertRepo = {
      create: jest.fn((data) => ({ id: 'alert-1', ...data })),
      save: jest.fn((entities) =>
        Promise.resolve(Array.isArray(entities) ? entities : [entities]),
      ),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };
    mockN8nTrigger = {
      triggerWorkflow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceMonitoringService,
        { provide: getRepositoryToken(PriceMonitoringJob), useValue: mockJobRepo },
        { provide: getRepositoryToken(PriceRecord), useValue: mockRecordRepo },
        { provide: getRepositoryToken(PriceAlert), useValue: mockAlertRepo },
        { provide: N8nTriggerService, useValue: mockN8nTrigger },
      ],
    }).compile();

    service = module.get(PriceMonitoringService);
  });

  describe('triggerMonitoring', () => {
    it('should create a PENDING job and trigger n8n workflow', async () => {
      (mockN8nTrigger.triggerWorkflow as jest.Mock).mockResolvedValue({
        success: true,
        executionId: 'exec-123',
      });

      const result = await service.triggerMonitoring(
        { productIds: ['prod-1', 'prod-2'] },
        mockUserId,
        mockOrgId,
      );

      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrgId,
          status: PriceMonitoringJobStatus.PENDING,
          triggerType: PriceMonitoringTriggerType.MANUAL,
          triggeredBy: mockUserId,
          totalProducts: 2,
        }),
      );
      expect(mockN8nTrigger.triggerWorkflow).toHaveBeenCalledWith(
        'price-monitoring',
        expect.objectContaining({
          jobId: mockJobId,
          organizationId: mockOrgId,
          productIds: ['prod-1', 'prod-2'],
        }),
      );
      expect(mockJobRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should mark job as FAILED when n8n trigger fails', async () => {
      (mockN8nTrigger.triggerWorkflow as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });

      await service.triggerMonitoring({}, mockUserId, mockOrgId);

      const secondSaveCall = mockJobRepo.save.mock.calls[1][0];
      expect(secondSaveCall.status).toBe(PriceMonitoringJobStatus.FAILED);
      expect(secondSaveCall.error).toBe('Connection refused');
    });

    it('should set job status to RUNNING with executionId on success', async () => {
      (mockN8nTrigger.triggerWorkflow as jest.Mock).mockResolvedValue({
        success: true,
        executionId: 'exec-456',
      });

      await service.triggerMonitoring({}, mockUserId, mockOrgId);

      const secondSaveCall = mockJobRepo.save.mock.calls[1][0];
      expect(secondSaveCall.status).toBe(PriceMonitoringJobStatus.RUNNING);
      expect(secondSaveCall.n8nExecutionId).toBe('exec-456');
    });
  });

  describe('handleCallback', () => {
    const mockJob = {
      id: mockJobId,
      organizationId: mockOrgId,
      status: PriceMonitoringJobStatus.RUNNING,
    };

    it('should throw NotFoundException when job not found', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleCallback({
          jobId: 'nonexistent',
          executionId: 'exec-1',
          status: 'completed',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save price records and update job status on completed callback', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      const result = await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product A',
            previousPrice: 100000,
            currentPrice: 110000,
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockRecordRepo.save).toHaveBeenCalled();
      expect(result.received).toBe(true);
    });

    it('should generate INFO alert when price change is >= 5% but < 15%', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product A',
            previousPrice: 100000,
            currentPrice: 108000, // 8% increase
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: PriceAlertSeverity.INFO }),
      );
      expect(mockAlertRepo.save).toHaveBeenCalled();
    });

    it('should generate WARNING alert when price change is >= 15% but < 30%', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product B',
            previousPrice: 100000,
            currentPrice: 120000, // 20% increase
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: PriceAlertSeverity.WARNING }),
      );
    });

    it('should generate CRITICAL alert when price change is >= 30%', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product C',
            previousPrice: 100000,
            currentPrice: 140000, // 40% increase
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: PriceAlertSeverity.CRITICAL }),
      );
    });

    it('should not generate alert when price change is below INFO threshold (< 5%)', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      const result = await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product D',
            previousPrice: 100000,
            currentPrice: 103000, // 3% increase - below INFO threshold
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockAlertRepo.create).not.toHaveBeenCalled();
      expect(result.alertsGenerated).toBe(0);
    });

    it('should generate alert for price decrease too', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'completed',
        results: [
          {
            productId: 'prod-1',
            productName: 'Product E',
            previousPrice: 100000,
            currentPrice: 60000, // -40% decrease
            currencyCode: 'VND',
            fetchedAt: new Date().toISOString(),
          },
        ],
      });

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: PriceAlertSeverity.CRITICAL }),
      );
    });

    it('should update job to failed status on failed callback', async () => {
      mockJobRepo.findOne.mockResolvedValue({ ...mockJob });

      await service.handleCallback({
        jobId: mockJobId,
        executionId: 'exec-1',
        status: 'failed',
        error: 'n8n workflow timed out',
      });

      const savedJob = mockJobRepo.save.mock.calls[0][0];
      expect(savedJob.status).toBe(PriceMonitoringJobStatus.FAILED);
      expect(savedJob.error).toBe('n8n workflow timed out');
    });
  });

  describe('findAllJobs', () => {
    it('should return paginated jobs for the organization', async () => {
      const mockData = [
        { id: 'job-1', organizationId: mockOrgId, status: PriceMonitoringJobStatus.COMPLETED },
      ];
      mockJobRepo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAllJobs({ page: 1, limit: 20 }, mockOrgId);

      expect(mockJobRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: mockOrgId },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockJobRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllJobs({ status: 'running', page: 1, limit: 20 }, mockOrgId);

      expect(mockJobRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: mockOrgId, status: 'running' },
        }),
      );
    });
  });

  describe('markAlertRead', () => {
    it('should mark a single alert as read', async () => {
      const mockAlert = {
        id: 'alert-1',
        organizationId: mockOrgId,
        isRead: false,
      };
      mockAlertRepo.findOne.mockResolvedValue(mockAlert);

      await service.markAlertRead('alert-1', mockOrgId);

      expect(mockAlertRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
      );
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockAlertRepo.findOne.mockResolvedValue(null);

      await expect(service.markAlertRead('nonexistent', mockOrgId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAlertsRead', () => {
    it('should mark all unread alerts as read for the organization', async () => {
      mockAlertRepo.update.mockResolvedValue({ affected: 5 });

      const result = await service.markAllAlertsRead(mockOrgId);

      expect(mockAlertRepo.update).toHaveBeenCalledWith(
        { organizationId: mockOrgId, isRead: false },
        { isRead: true },
      );
      expect(result.success).toBe(true);
    });
  });
});
