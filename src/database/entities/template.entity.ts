import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'default_terms', type: 'text', nullable: true })
  defaultTerms: string;

  @Column({ name: 'default_notes', type: 'text', nullable: true })
  defaultNotes: string;

  @Column({ name: 'default_tax', type: 'decimal', precision: 5, scale: 2, default: 0 })
  defaultTax: number;

  @Column({ name: 'default_discount', type: 'decimal', precision: 5, scale: 2, default: 0 })
  defaultDiscount: number;

  @Column({ type: 'jsonb', nullable: true })
  items: any[];

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, (user) => user.templates)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
