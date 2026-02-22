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

@Entity('glossary_terms')
@Unique(['organizationId', 'sourceTerm'])
export class GlossaryTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'source_term' })
  sourceTerm: string;

  @Column({ name: 'target_term' })
  targetTerm: string;

  @Column({ name: 'source_language', default: 'en' })
  sourceLanguage: string;

  @Column({ name: 'target_language', default: 'vi' })
  targetLanguage: string;

  @Index()
  @Column({ nullable: true })
  category: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
