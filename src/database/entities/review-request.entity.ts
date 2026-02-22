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
import { Quotation } from './quotation.entity';
import { User } from './user.entity';

export enum ReviewType {
  INGESTION = 'ingestion',
  STATUS_CHANGE = 'status_change',
  PRICE_OVERRIDE = 'price_override',
  COMPARISON = 'comparison',
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested',
}

@Entity('review_requests')
export class ReviewRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'enum', enum: ReviewType })
  type: ReviewType;

  @Index()
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @Index()
  @Column({ name: 'quotation_id', nullable: true })
  quotationId: string;

  @ManyToOne(() => Quotation, { nullable: true })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @Column({ name: 'job_id', nullable: true })
  jobId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ name: 'proposed_data', type: 'jsonb', nullable: true })
  proposedData: Record<string, any>;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes: string;

  @Column({ name: 'reviewer_changes', type: 'jsonb', nullable: true })
  reviewerChanges: Record<string, any>;

  @Column({ name: 'requested_by' })
  requestedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requestedByUser: User;

  @Index()
  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedToUser: User;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser: User;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
