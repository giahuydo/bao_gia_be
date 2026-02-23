import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration';

// Existing entities
import { User } from './database/entities/user.entity';
import { Customer } from './database/entities/customer.entity';
import { Product } from './database/entities/product.entity';
import { Quotation } from './database/entities/quotation.entity';
import { QuotationItem } from './database/entities/quotation-item.entity';
import { Template } from './database/entities/template.entity';
import { Currency } from './database/entities/currency.entity';
import { CompanySettings } from './database/entities/company-settings.entity';
import { Attachment } from './database/entities/attachment.entity';
import { QuotationHistory } from './database/entities/quotation-history.entity';
import { N8nExecutionLog } from './database/entities/n8n-execution-log.entity';
import { TokenUsage } from './database/entities/token-usage.entity';

// New entities (SaaS extension)
import { Organization } from './database/entities/organization.entity';
import { OrganizationMember } from './database/entities/organization-member.entity';
import { GlossaryTerm } from './database/entities/glossary-term.entity';
import { AiPromptVersion } from './database/entities/ai-prompt-version.entity';
import { IngestionJob } from './database/entities/ingestion-job.entity';
import { RuleSet } from './database/entities/rule-set.entity';
import { FileChecksumCache } from './database/entities/file-checksum-cache.entity';
import { QuotationVersion } from './database/entities/quotation-version.entity';
import { ReviewRequest } from './database/entities/review-request.entity';
import { PriceMonitoringJob } from './database/entities/price-monitoring-job.entity';
import { PriceRecord } from './database/entities/price-record.entity';
import { PriceAlert } from './database/entities/price-alert.entity';

// Existing modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AiModule } from './modules/ai/ai.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { CompanySettingsModule } from './modules/company-settings/company-settings.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

// New modules (SaaS extension)
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { VersioningModule } from './modules/versioning/versioning.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { GlossaryModule } from './modules/glossary/glossary.module';
import { RulesModule } from './modules/rules/rules.module';
import { PriceMonitoringModule } from './modules/price-monitoring/price-monitoring.module';

// Infrastructure
import { N8nTriggerModule } from './common/services/n8n-trigger.module';

// Telegram
import { TelegramModule } from './modules/telegram/telegram.module';

// Health
import { HealthModule } from './modules/health/health.module';

// Middleware
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [
          // Existing
          User,
          Customer,
          Product,
          Quotation,
          QuotationItem,
          Template,
          Currency,
          CompanySettings,
          Attachment,
          QuotationHistory,
          N8nExecutionLog,
          TokenUsage,
          // New (SaaS extension)
          Organization,
          OrganizationMember,
          GlossaryTerm,
          AiPromptVersion,
          IngestionJob,
          RuleSet,
          FileChecksumCache,
          QuotationVersion,
          ReviewRequest,
          // Price Monitoring
          PriceMonitoringJob,
          PriceRecord,
          PriceAlert,
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
    // Existing modules
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    QuotationsModule,
    TemplatesModule,
    AiModule,
    CurrenciesModule,
    CompanySettingsModule,
    AttachmentsModule,
    IngestionModule,
    WebhooksModule,
    // New modules (SaaS extension)
    OrganizationsModule,
    JobsModule,
    VersioningModule,
    ReviewsModule,
    PromptsModule,
    GlossaryModule,
    RulesModule,
    PriceMonitoringModule,
    // Infrastructure
    N8nTriggerModule,
    TelegramModule.forRoot(),
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
