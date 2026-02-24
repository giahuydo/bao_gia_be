import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { IngestionJob, JobStatus } from '../../database/entities/ingestion-job.entity';
import { CreateJobDto } from './dto/create-job.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const JOB_ID = 'job-uuid-1';
const ATTACHMENT_ID = 'attachment-uuid-1';

const makeJob = (overrides: Partial<IngestionJob> = {}): IngestionJob => ({
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
  createdBy: USER_ID,
  processingTimeMs: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  organization: null,
  ...overrides,
} as IngestionJob);

describe('JobsService', () => {
  let service: JobsService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ id: JOB_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(IngestionJob), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  describe('create', () => {
    it('should create a job with pending status, orgId, and userId', async () => {
      const dto: CreateJobDto = { attachmentId: ATTACHMENT_ID };
      const savedJob = makeJob();
      mockRepo.save.mockResolvedValue(savedJob);

      const result = await service.create(dto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        organizationId: ORG_ID,
        createdBy: USER_ID,
        status: JobStatus.PENDING,
      });
      expect(result.status).toBe(JobStatus.PENDING);
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.createdBy).toBe(USER_ID);
    });

    it('should create a job with optional customerId when provided', async () => {
      const dto: CreateJobDto = { attachmentId: ATTACHMENT_ID, customerId: 'customer-uuid-1' };
      const savedJob = makeJob({ customerId: 'customer-uuid-1' });
      mockRepo.save.mockResolvedValue(savedJob);

      const result = await service.create(dto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'customer-uuid-1' }),
      );
      expect(result.customerId).toBe('customer-uuid-1');
    });

    it('should return the saved job entity', async () => {
      const dto: CreateJobDto = { attachmentId: ATTACHMENT_ID };
      const savedJob = makeJob();
      mockRepo.save.mockResolvedValue(savedJob);

      const result = await service.create(dto, USER_ID, ORG_ID);

      expect(result).toEqual(savedJob);
    });
  });

  describe('findAll', () => {
    it('should scope query by organizationId', async () => {
      await service.findAll(ORG_ID, {});

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('should apply status filter when provided', async () => {
      await service.findAll(ORG_ID, { status: JobStatus.FAILED });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: JobStatus.FAILED }),
        }),
      );
    });

    it('should not apply status filter when not provided', async () => {
      await service.findAll(ORG_ID, {});

      const callArg = mockRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
    });

    it('should return paginated results with default page and limit', async () => {
      const jobs = [makeJob(), makeJob({ id: 'job-uuid-2' })];
      mockRepo.findAndCount.mockResolvedValue([jobs, 2]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply correct skip when page is specified', async () => {
      await service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should order results by createdAt DESC', async () => {
      await service.findAll(ORG_ID, {});

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('should return empty data when no jobs match the filter', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(ORG_ID, { status: JobStatus.COMPLETED });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a job when found by id and organizationId', async () => {
      const job = makeJob();
      mockRepo.findOne.mockResolvedValue(job);

      const result = await service.findOne(JOB_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: JOB_ID, organizationId: ORG_ID },
      });
      expect(result).toEqual(job);
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(JOB_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(JOB_ID, ORG_ID)).rejects.toThrow('Job not found');
    });

    it('should throw NotFoundException when querying a different organization job', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(JOB_ID, 'other-org-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retry', () => {
    it('should reset a failed job to pending and increment retries', async () => {
      const failedJob = makeJob({ status: JobStatus.FAILED, retries: 1, maxRetries: 3 });
      mockRepo.findOne.mockResolvedValue(failedJob);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.retry(JOB_ID, ORG_ID);

      expect(result.status).toBe(JobStatus.PENDING);
      expect(result.retries).toBe(2);
    });

    it('should reset a dead_letter job to pending when retries is below maxRetries', async () => {
      const deadLetterJob = makeJob({ status: JobStatus.DEAD_LETTER, retries: 1, maxRetries: 3 });
      mockRepo.findOne.mockResolvedValue(deadLetterJob);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.retry(JOB_ID, ORG_ID);

      expect(result.status).toBe(JobStatus.PENDING);
    });

    it('should set status to dead_letter when retries has reached maxRetries', async () => {
      const failedJob = makeJob({ status: JobStatus.FAILED, retries: 3, maxRetries: 3 });
      mockRepo.findOne.mockResolvedValue(failedJob);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.retry(JOB_ID, ORG_ID);

      expect(result.status).toBe(JobStatus.DEAD_LETTER);
    });

    it('should clear error and errorStack on successful retry reset', async () => {
      const failedJob = makeJob({
        status: JobStatus.FAILED,
        retries: 0,
        maxRetries: 3,
        error: 'Connection timeout',
        errorStack: 'Error: Connection timeout\n  at ...',
      });
      mockRepo.findOne.mockResolvedValue(failedJob);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.retry(JOB_ID, ORG_ID);

      expect((result as any).error).toBeNull();
      expect((result as any).errorStack).toBeNull();
    });

    it('should throw BadRequestException when retrying a pending job', async () => {
      const pendingJob = makeJob({ status: JobStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingJob);

      await expect(service.retry(JOB_ID, ORG_ID)).rejects.toThrow(BadRequestException);
      await expect(service.retry(JOB_ID, ORG_ID)).rejects.toThrow(
        'Only failed or dead-letter jobs can be retried',
      );
    });

    it('should throw BadRequestException when retrying a completed job', async () => {
      const completedJob = makeJob({ status: JobStatus.COMPLETED });
      mockRepo.findOne.mockResolvedValue(completedJob);

      await expect(service.retry(JOB_ID, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when retrying an extracting job', async () => {
      const extractingJob = makeJob({ status: JobStatus.EXTRACTING });
      mockRepo.findOne.mockResolvedValue(extractingJob);

      await expect(service.retry(JOB_ID, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.retry('non-existent-id', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('should save the updated job after retry', async () => {
      const failedJob = makeJob({ status: JobStatus.FAILED, retries: 0, maxRetries: 3 });
      mockRepo.findOne.mockResolvedValue(failedJob);

      await service.retry(JOB_ID, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: JobStatus.PENDING }),
      );
    });
  });
});
