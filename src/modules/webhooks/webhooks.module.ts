import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { N8nExecutionLog } from '../../database/entities/n8n-execution-log.entity';
import { QuotationHistory } from '../../database/entities/quotation-history.entity';
import { Quotation } from '../../database/entities/quotation.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([N8nExecutionLog, QuotationHistory, Quotation]),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
