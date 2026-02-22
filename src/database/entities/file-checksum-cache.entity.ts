import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('file_checksum_cache')
@Unique(['checksum', 'organizationId'])
export class FileChecksumCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 64 })
  checksum: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'original_file_name' })
  originalFileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'extract_result', type: 'jsonb', nullable: true })
  extractResult: Record<string, any>;

  @Column({ name: 'translate_result', type: 'jsonb', nullable: true })
  translateResult: Record<string, any>;

  @Column({ name: 'prompt_version_id', nullable: true })
  promptVersionId: string;

  @Column({ name: 'hit_count', type: 'int', default: 0 })
  hitCount: number;

  @Column({ name: 'last_hit_at', type: 'timestamp', nullable: true })
  lastHitAt: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
