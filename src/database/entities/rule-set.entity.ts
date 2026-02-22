import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Organization } from './organization.entity';

export enum RuleCategory {
  LAB = 'lab',
  BIOTECH = 'biotech',
  ICU = 'icu',
  ANALYTICAL = 'analytical',
  GENERAL = 'general',
}

@Entity('rule_sets')
@Unique(['organizationId', 'category'])
export class RuleSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'enum', enum: RuleCategory })
  category: RuleCategory;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  rules: Array<{
    field: string;
    operator: string;
    value: any;
    action: string;
    actionValue?: any;
    priority: number;
    message?: string;
  }>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
