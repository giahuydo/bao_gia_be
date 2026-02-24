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

  @Column({ name: 'triggered_by', type: 'varchar', nullable: true })
  triggeredBy: string;

  @Column({ name: 'total_products', type: 'int', default: 0 })
  totalProducts: number;

  @Column({ name: 'processed_products', type: 'int', default: 0 })
  processedProducts: number;

  @Column({ name: 'alert_count', type: 'int', default: 0 })
  alertCount: number;

  @Column({ name: 'n8n_execution_id', type: 'varchar', nullable: true })
  n8nExecutionId: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
