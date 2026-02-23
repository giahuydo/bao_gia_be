import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { Context } from 'telegraf';
import { Quotation, QuotationStatus } from '../../database/entities/quotation.entity';
import { Customer } from '../../database/entities/customer.entity';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly chatId: string;
  private readonly orgId: string;

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private configService: ConfigService,
    @InjectRepository(Quotation)
    private quotationsRepository: Repository<Quotation>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {
    this.chatId = this.configService.get<string>('telegram.chatId') || '';
    this.orgId = this.configService.get<string>('telegram.orgId') || '';
  }

  async sendMessage(text: string, extra?: Record<string, any>): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not configured, skipping message');
      return;
    }
    try {
      await this.bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (err) {
      this.logger.error(`Failed to send Telegram message: ${err.message}`);
    }
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return '0 VND';
    return Number(amount).toLocaleString('vi-VN') + ' VND';
  }

  formatStatus(status: string): string {
    const icons: Record<string, string> = {
      draft: '📝 Draft',
      sent: '📤 Sent',
      accepted: '✅ Accepted',
      rejected: '❌ Rejected',
      expired: '⏰ Expired',
    };
    return icons[status] || status;
  }

  formatQuotation(q: Quotation): string {
    const lines = [
      `<b>${q.quotationNumber}</b> — ${this.formatStatus(q.status)}`,
      `📋 ${q.title}`,
      `👤 ${q.customer?.name || 'N/A'}`,
      `💰 ${this.formatCurrency(q.total)}`,
    ];
    if (q.validUntil) {
      lines.push(`📅 Valid until: ${new Date(q.validUntil).toLocaleDateString('vi-VN')}`);
    }
    if (q.items?.length) {
      lines.push(`📦 ${q.items.length} item(s)`);
    }
    return lines.join('\n');
  }

  formatQuotationList(quotations: Quotation[]): string {
    if (quotations.length === 0) return 'No quotations found.';
    return quotations
      .map(
        (q, i) =>
          `${i + 1}. <b>${q.quotationNumber}</b> — ${q.title}\n   ${this.formatStatus(q.status)} | ${this.formatCurrency(q.total)}`,
      )
      .join('\n\n');
  }

  quotationKeyboard(quotationId: string, status: string) {
    const buttons: { text: string; callback_data: string }[][] = [];

    if (status === QuotationStatus.DRAFT) {
      buttons.push([
        { text: '📤 Send', callback_data: `send:quotation:${quotationId}` },
      ]);
    }
    if (status === QuotationStatus.SENT) {
      buttons.push([
        { text: '✅ Accept', callback_data: `accept:quotation:${quotationId}` },
        { text: '❌ Reject', callback_data: `reject:quotation:${quotationId}` },
      ]);
    }

    return buttons.length > 0
      ? Markup.inlineKeyboard(buttons)
      : undefined;
  }

  async findQuotationByNumber(quotationNumber: string): Promise<Quotation | null> {
    return this.quotationsRepository.findOne({
      where: { quotationNumber: ILike(`%${quotationNumber}%`), organizationId: this.orgId },
      relations: ['customer', 'items'],
    });
  }

  async findRecentQuotations(limit = 10): Promise<Quotation[]> {
    return this.quotationsRepository.find({
      where: { organizationId: this.orgId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async searchQuotations(query: string): Promise<Quotation[]> {
    return this.quotationsRepository.find({
      where: [
        { title: ILike(`%${query}%`), organizationId: this.orgId },
        { quotationNumber: ILike(`%${query}%`), organizationId: this.orgId },
      ],
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async findCustomersByName(name: string): Promise<Customer[]> {
    return this.customersRepository.find({
      where: { name: ILike(`%${name}%`), organizationId: this.orgId },
      take: 5,
    });
  }
}
