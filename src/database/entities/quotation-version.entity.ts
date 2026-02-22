import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Quotation } from './quotation.entity';
import { User } from './user.entity';

@Entity('quotation_versions')
@Unique(['quotationId', 'versionNumber'])
export class QuotationVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'quotation_id' })
  quotationId: string;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'text', nullable: true })
  label: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, any>;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
