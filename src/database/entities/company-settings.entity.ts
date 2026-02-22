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

@Entity('company_settings')
export class CompanySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'company_name_en', nullable: true })
  companyNameEn: string;

  @Column({ name: 'tax_code', nullable: true })
  taxCode: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'bank_account', nullable: true })
  bankAccount: string;

  @Column({ name: 'bank_branch', nullable: true })
  bankBranch: string;

  @Column({ name: 'quotation_prefix', default: 'BG' })
  quotationPrefix: string;

  @Column({ name: 'quotation_terms', type: 'text', nullable: true })
  quotationTerms: string;

  @Column({ name: 'quotation_notes', type: 'text', nullable: true })
  quotationNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
