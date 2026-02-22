import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Customer } from './customer.entity';
import { Product } from './product.entity';
import { Quotation } from './quotation.entity';
import { Template } from './template.entity';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALES = 'sales',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.SALES })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Customer, (customer) => customer.createdByUser)
  customers: Customer[];

  @OneToMany(() => Product, (product) => product.createdByUser)
  products: Product[];

  @OneToMany(() => Quotation, (quotation) => quotation.createdByUser)
  quotations: Quotation[];

  @OneToMany(() => Template, (template) => template.createdByUser)
  templates: Template[];
}
