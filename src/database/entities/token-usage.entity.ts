import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AiOperation {
  GENERATE = 'generate',
  SUGGEST = 'suggest',
  IMPROVE = 'improve',
  EXTRACT = 'extract',
  TRANSLATE = 'translate',
}

@Entity('token_usage')
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'quotation_id', nullable: true })
  quotationId: string;

  @Column({ type: 'enum', enum: AiOperation })
  operation: AiOperation;

  @Column()
  model: string;

  @Column({ name: 'input_tokens', type: 'int' })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int' })
  outputTokens: number;

  @Column({ name: 'total_tokens', type: 'int' })
  totalTokens: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 6 })
  costUsd: number;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  /** Reserved for future multi-tenant SaaS */
  @Index()
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'n8n_execution_id', nullable: true })
  n8nExecutionId: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
