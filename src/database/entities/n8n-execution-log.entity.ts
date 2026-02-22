import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ExecutionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

@Entity('n8n_execution_log')
export class N8nExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_name' })
  workflowName: string;

  @Index()
  @Column({ name: 'execution_id' })
  executionId: string;

  @Column({ type: 'enum', enum: ExecutionStatus })
  status: ExecutionStatus;

  @Index()
  @Column({ name: 'quotation_id', nullable: true })
  quotationId: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
