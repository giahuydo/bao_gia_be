import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionJob, JobStatus } from '../../database/entities/ingestion-job.entity';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(IngestionJob)
    private jobsRepository: Repository<IngestionJob>,
  ) {}

  async create(dto: CreateJobDto, userId: string, orgId: string) {
    const job = this.jobsRepository.create({
      ...dto,
      organizationId: orgId,
      createdBy: userId,
      status: JobStatus.PENDING,
    });
    return this.jobsRepository.save(job);
  }

  async findAll(orgId: string, filters: { status?: JobStatus; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { organizationId: orgId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.jobsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, orgId: string) {
    const job = await this.jobsRepository.findOne({
      where: { id, organizationId: orgId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async retry(id: string, orgId: string) {
    const job = await this.findOne(id, orgId);
    if (![JobStatus.FAILED, JobStatus.DEAD_LETTER].includes(job.status)) {
      throw new BadRequestException('Only failed or dead-letter jobs can be retried');
    }
    if (job.retries >= job.maxRetries) {
      job.status = JobStatus.DEAD_LETTER;
      return this.jobsRepository.save(job);
    }
    job.status = JobStatus.PENDING;
    job.retries += 1;
    (job as any).error = null;
    (job as any).errorStack = null;
    return this.jobsRepository.save(job);
  }
}
