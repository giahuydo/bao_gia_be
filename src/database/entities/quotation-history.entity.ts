import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quotation } from './quotation.entity';
import { User } from './user.entity';

export enum HistoryAction {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  DUPLICATED = 'duplicated',
  PDF_EXPORTED = 'pdf_exported',
  AI_EXTRACTED = 'ai_extracted',
  AI_TRANSLATED = 'ai_translated',
  NORMALIZED = 'normalized',
  EMAIL_SENT = 'email_sent',
  INGESTION_FAILED = 'ingestion_failed',
  VERSION_CREATED = 'version_created',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  COMPARISON_RUN = 'comparison_run',
}

@Entity('quotation_history')
export class QuotationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quotation_id' })
  quotationId: string;

  @ManyToOne(() => Quotation, (quotation) => quotation.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @Column({ type: 'enum', enum: HistoryAction })
  action: HistoryAction;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'performed_by' })
  performedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performedByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
