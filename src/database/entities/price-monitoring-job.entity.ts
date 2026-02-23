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

export enum PriceMonitoringJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum PriceMonitoringTriggerType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
}

@Entity('price_monitoring_jobs')
export class PriceMonitoringJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({
    type: 'enum',
    enum: PriceMonitoringJobStatus,
    default: PriceMonitoringJobStatus.PENDING,
  })
  status: PriceMonitoringJobStatus;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: PriceMonitoringTriggerType,
  })
  triggerType: PriceMonitoringTriggerType;

  @Column({ name: 'triggered_by', nullable: true })
  triggeredBy: string | null;

  @Column({ name: 'total_products', type: 'int', default: 0 })
  totalProducts: number;

  @Column({ name: 'processed_products', type: 'int', default: 0 })
  processedProducts: number;

  @Column({ name: 'alert_count', type: 'int', default: 0 })
  alertCount: number;

  @Column({ name: 'n8n_execution_id', nullable: true })
  n8nExecutionId: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
