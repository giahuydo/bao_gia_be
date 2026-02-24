import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PriceMonitoringJob } from './price-monitoring-job.entity';

@Entity('price_records')
export class PriceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'job_id' })
  jobId: string;

  @ManyToOne(() => PriceMonitoringJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: PriceMonitoringJob;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ name: 'previous_price', type: 'decimal', precision: 15, scale: 2 })
  previousPrice: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 15, scale: 2 })
  currentPrice: number;

  @Column({ name: 'price_change', type: 'decimal', precision: 15, scale: 2 })
  priceChange: number;

  @Column({ name: 'price_change_percent', type: 'decimal', precision: 8, scale: 2 })
  priceChangePercent: number;

  @Column({ name: 'currency_code', length: 3, default: 'VND' })
  currencyCode: string;

  @Column({ type: 'varchar', nullable: true })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamp' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
