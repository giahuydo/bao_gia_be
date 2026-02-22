import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
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
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
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
  ],
})
export class AppModule {}
