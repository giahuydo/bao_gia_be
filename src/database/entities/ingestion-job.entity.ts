import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';

export enum JobStatus {
  PENDING = 'pending',
  EXTRACTING = 'extracting',
  TRANSLATING = 'translating',
  NORMALIZING = 'normalizing',
  REVIEW_PENDING = 'review_pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
}

@Entity('ingestion_jobs')
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'attachment_id' })
  attachmentId: string;

  @Index()
  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Column({ name: 'current_step', nullable: true })
  currentStep: string;

  @Column({ type: 'int', default: 0 })
  retries: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Index()
  @Column({ name: 'file_checksum', length: 64, nullable: true })
  fileChecksum: string;

  @Column({ name: 'extract_result', type: 'jsonb', nullable: true })
  extractResult: Record<string, any>;

  @Column({ name: 'translate_result', type: 'jsonb', nullable: true })
  translateResult: Record<string, any>;

  @Column({ name: 'normalize_result', type: 'jsonb', nullable: true })
  normalizeResult: Record<string, any>;

  @Column({ name: 'quotation_id', nullable: true })
  quotationId: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ name: 'n8n_execution_id', nullable: true })
  n8nExecutionId: string;

  @Index()
  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string;

  @Column({ name: 'prompt_version_id', nullable: true })
  promptVersionId: string;

  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
