import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { PriceMonitoringJob } from './price-monitoring-job.entity';

export enum PriceAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('price_alerts')
export class PriceAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index()
  @Column({ name: 'job_id' })
  jobId: string;

  @ManyToOne(() => PriceMonitoringJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: PriceMonitoringJob;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'product_name', type: 'varchar', nullable: true })
  productName: string;

  @Index()
  @Column({ type: 'enum', enum: PriceAlertSeverity })
  severity: PriceAlertSeverity;

  @Column({ name: 'previous_price', type: 'decimal', precision: 15, scale: 2 })
  previousPrice: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 15, scale: 2 })
  currentPrice: number;

  @Column({ name: 'price_change_percent', type: 'decimal', precision: 8, scale: 2 })
  priceChangePercent: number;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
