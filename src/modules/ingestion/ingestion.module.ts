import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { Attachment } from '../../database/entities/attachment.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { IngestionJob } from '../../database/entities/ingestion-job.entity';
import { FileChecksumCache } from '../../database/entities/file-checksum-cache.entity';
import { GlossaryTerm } from '../../database/entities/glossary-term.entity';
import { AiPromptVersion } from '../../database/entities/ai-prompt-version.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Attachment,
      Product,
      Customer,
      IngestionJob,
      FileChecksumCache,
      GlossaryTerm,
      AiPromptVersion,
    ]),
    AiModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
