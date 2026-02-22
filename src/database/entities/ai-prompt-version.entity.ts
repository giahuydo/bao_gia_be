import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum PromptType {
  EXTRACT = 'extract',
  TRANSLATE = 'translate',
  GENERATE = 'generate',
  SUGGEST = 'suggest',
  IMPROVE = 'improve',
  COMPARE = 'compare',
}

@Entity('ai_prompt_versions')
@Unique(['type', 'versionNumber'])
export class AiPromptVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: PromptType })
  type: PromptType;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ name: 'system_prompt', type: 'text' })
  systemPrompt: string;

  @Column({ name: 'user_prompt_template', type: 'text' })
  userPromptTemplate: string;

  @Column()
  model: string;

  @Column({ name: 'max_tokens', type: 'int' })
  maxTokens: number;

  @Index()
  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'change_notes', type: 'text', nullable: true })
  changeNotes: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
