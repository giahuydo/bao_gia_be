import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Markup } from 'telegraf';
import { TelegramService } from './telegram.service';
import {
  QuotationStatusChangedEvent,
  IngestionJobCompletedEvent,
  ReviewRequestCreatedEvent,
} from './events/telegram.events';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  constructor(private telegramService: TelegramService) {}

  @OnEvent('quotation.status_changed')
  async handleQuotationStatusChanged(event: QuotationStatusChangedEvent) {
    try {
      const lines = [
        `📊 <b>Quotation Status Changed</b>`,
        '',
        `<b>${event.quotationNumber}</b> — ${event.title}`,
        `${this.telegramService.formatStatus(event.oldStatus)} → ${this.telegramService.formatStatus(event.newStatus)}`,
      ];

      if (event.customerName) lines.push(`👤 ${event.customerName}`);
      if (event.total != null) lines.push(`💰 ${this.telegramService.formatCurrency(event.total)}`);

      const keyboard = this.telegramService.quotationKeyboard(event.quotationId, event.newStatus);
      await this.telegramService.sendMessage(
        lines.join('\n'),
        keyboard ? keyboard : undefined,
      );
    } catch (err) {
      this.logger.error(`Failed to notify status change: ${err.message}`);
    }
  }

  @OnEvent('job.completed')
  async handleJobCompleted(event: IngestionJobCompletedEvent) {
    try {
      const icon = event.status === 'completed' ? '✅' : '❌';
      const lines = [
        `${icon} <b>Ingestion Job ${event.status.toUpperCase()}</b>`,
        '',
        `Job: ${event.jobId.slice(0, 8)}...`,
      ];

      if (event.quotationNumber) {
        lines.push(`Quotation: <b>${event.quotationNumber}</b>`);
      }
      if (event.error) {
        lines.push(`Error: ${event.error.slice(0, 200)}`);
      }

      await this.telegramService.sendMessage(lines.join('\n'));
    } catch (err) {
      this.logger.error(`Failed to notify job status: ${err.message}`);
    }
  }

  @OnEvent('job.failed')
  async handleJobFailed(event: IngestionJobCompletedEvent) {
    await this.handleJobCompleted(event);
  }

  @OnEvent('review.created')
  async handleReviewCreated(event: ReviewRequestCreatedEvent) {
    try {
      const lines = [
        `🔍 <b>New Review Request</b>`,
        '',
        `Type: ${event.type}`,
        `Requested by: ${event.requestedByName}`,
      ];

      if (event.quotationNumber) {
        lines.push(`Quotation: <b>${event.quotationNumber}</b>`);
      }
      if (event.assignedToName) {
        lines.push(`Assigned to: ${event.assignedToName}`);
      }

      const keyboard = Markup.inlineKeyboard([
        [
          { text: '✅ Approve', callback_data: `approve:review:${event.reviewId}` },
          { text: '❌ Reject', callback_data: `reject:review:${event.reviewId}` },
        ],
      ]);

      await this.telegramService.sendMessage(lines.join('\n'), keyboard);
    } catch (err) {
      this.logger.error(`Failed to notify review: ${err.message}`);
    }
  }
}
