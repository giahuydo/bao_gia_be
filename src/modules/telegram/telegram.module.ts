import { DynamicModule, Module, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TypeOrmModule } from '@nestjs/typeorm';
import { session } from 'telegraf';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { TelegramNotificationService } from './telegram-notification.service';
import { ChatIdGuard } from './guards/chat-id.guard';
import { CreateQuotationWizard } from './scenes/create-quotation.wizard';
import { Quotation } from '../../database/entities/quotation.entity';
import { Customer } from '../../database/entities/customer.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({})
export class TelegramModule {
  private static readonly logger = new Logger(TelegramModule.name);

  static forRoot(): DynamicModule {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
      return {
        module: TelegramModule,
        providers: [
          {
            provide: TelegramService,
            useValue: new NoOpTelegramService(),
          },
          {
            provide: TelegramNotificationService,
            useValue: new NoOpNotificationService(),
          },
        ],
        exports: [TelegramService, TelegramNotificationService],
      };
    }

    this.logger.log('Telegram bot enabled');

    return {
      module: TelegramModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forFeature([Quotation, Customer]),
        QuotationsModule,
        ReviewsModule,
        TelegrafModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            token: configService.get<string>('telegram.botToken')!,
            middlewares: [session()],
            launchOptions: {
              dropPendingUpdates: true,
            },
          }),
        }),
      ],
      providers: [
        TelegramService,
        TelegramUpdate,
        TelegramNotificationService,
        ChatIdGuard,
        CreateQuotationWizard,
      ],
      exports: [TelegramService, TelegramNotificationService],
    };
  }
}

// No-op implementations for when bot token is not configured
class NoOpTelegramService {
  async sendMessage() {}
  formatCurrency(amount: number) {
    return amount != null ? `${Number(amount).toLocaleString('vi-VN')} VND` : '0 VND';
  }
  formatStatus(status: string) {
    return status;
  }
  formatQuotation() {
    return '';
  }
  formatQuotationList() {
    return '';
  }
  quotationKeyboard() {
    return undefined;
  }
  async findQuotationByNumber() {
    return null;
  }
  async findRecentQuotations() {
    return [];
  }
  async searchQuotations() {
    return [];
  }
  async findCustomersByName() {
    return [];
  }
}

class NoOpNotificationService {
  async handleQuotationStatusChanged() {}
  async handleJobCompleted() {}
  async handleJobFailed() {}
  async handleReviewCreated() {}
}
