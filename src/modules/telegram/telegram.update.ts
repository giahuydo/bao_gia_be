import { Logger, UseGuards } from '@nestjs/common';
import { Update, Start, Help, Command, Action, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramService } from './telegram.service';
import { ChatIdGuard } from './guards/chat-id.guard';
import { QuotationsService } from '../quotations/quotations.service';
import { ReviewsService } from '../reviews/reviews.service';
import { QuotationStatus } from '../../database/entities/quotation.entity';
import { ConfigService } from '@nestjs/config';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

@Update()
@UseGuards(ChatIdGuard)
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly orgId: string;

  constructor(
    private telegramService: TelegramService,
    private quotationsService: QuotationsService,
    private reviewsService: ReviewsService,
    configService: ConfigService,
  ) {
    this.orgId = configService.get<string>('telegram.orgId') || '';
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.replyWithHTML(
      [
        '<b>Quotation Bot</b> 🤖',
        '',
        'Quotation management bot. Use /help to see available commands.',
      ].join('\n'),
    );
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.replyWithHTML(
      [
        '<b>Available Commands:</b>',
        '',
        '/list — Recent quotations (latest 10)',
        '/quote &lt;number&gt; — View quotation details',
        '/search &lt;keyword&gt; — Search quotations',
        '/new — Create a new quotation (wizard)',
        '/help — Show this help message',
      ].join('\n'),
    );
  }

  @Command('list')
  async onList(@Ctx() ctx: Context) {
    try {
      const quotations = await this.telegramService.findRecentQuotations();
      const text = this.telegramService.formatQuotationList(quotations);
      await ctx.replyWithHTML(text);
    } catch (err) {
      this.logger.error(`/list error: ${err.message}`);
      await ctx.reply('Failed to fetch quotations. Please try again.');
    }
  }

  @Command('quote')
  async onQuote(@Ctx() ctx: Context) {
    try {
      const text = (ctx.message as any)?.text || '';
      const parts = text.split(/\s+/);
      const number = parts[1];

      if (!number) {
        await ctx.reply('Usage: /quote <quotation-number>\nExample: /quote BG-20260223-001');
        return;
      }

      const quotation = await this.telegramService.findQuotationByNumber(number);
      if (!quotation) {
        await ctx.reply(`Quotation "${number}" not found.`);
        return;
      }

      const formatted = this.telegramService.formatQuotation(quotation);
      const keyboard = this.telegramService.quotationKeyboard(quotation.id, quotation.status);

      await ctx.replyWithHTML(formatted, keyboard ? keyboard : undefined);
    } catch (err) {
      this.logger.error(`/quote error: ${err.message}`);
      await ctx.reply('Failed to fetch quotation. Please try again.');
    }
  }

  @Command('search')
  async onSearch(@Ctx() ctx: Context) {
    try {
      const text = (ctx.message as any)?.text || '';
      const query = text.replace(/^\/search\s*/, '').trim();

      if (!query) {
        await ctx.reply('Usage: /search <keyword>\nExample: /search laptop');
        return;
      }

      const quotations = await this.telegramService.searchQuotations(query);
      if (quotations.length === 0) {
        await ctx.reply(`No quotations found for "${query}".`);
        return;
      }

      const formatted = this.telegramService.formatQuotationList(quotations);
      await ctx.replyWithHTML(`🔍 Search results for "<b>${query}</b>":\n\n${formatted}`);
    } catch (err) {
      this.logger.error(`/search error: ${err.message}`);
      await ctx.reply('Search failed. Please try again.');
    }
  }

  // --- Inline keyboard actions ---

  @Action(/^send:quotation:(.+)$/)
  async onSendQuotation(@Ctx() ctx: Context) {
    try {
      const data = (ctx.callbackQuery as any)?.data || '';
      const quotationId = data.split(':')[2];

      await this.quotationsService.updateStatus(
        quotationId,
        QuotationStatus.SENT,
        SYSTEM_ACTOR_ID,
        this.orgId,
      );

      await ctx.answerCbQuery('Quotation marked as Sent!');
      await ctx.editMessageReplyMarkup(undefined);
    } catch (err) {
      this.logger.error(`send action error: ${err.message}`);
      await ctx.answerCbQuery('Failed to update status.');
    }
  }

  @Action(/^accept:quotation:(.+)$/)
  async onAcceptQuotation(@Ctx() ctx: Context) {
    try {
      const data = (ctx.callbackQuery as any)?.data || '';
      const quotationId = data.split(':')[2];

      await this.quotationsService.updateStatus(
        quotationId,
        QuotationStatus.ACCEPTED,
        SYSTEM_ACTOR_ID,
        this.orgId,
      );

      await ctx.answerCbQuery('Quotation accepted!');
      await ctx.editMessageReplyMarkup(undefined);
    } catch (err) {
      this.logger.error(`accept action error: ${err.message}`);
      await ctx.answerCbQuery('Failed to accept quotation.');
    }
  }

  @Action(/^reject:quotation:(.+)$/)
  async onRejectQuotation(@Ctx() ctx: Context) {
    try {
      const data = (ctx.callbackQuery as any)?.data || '';
      const quotationId = data.split(':')[2];

      await this.quotationsService.updateStatus(
        quotationId,
        QuotationStatus.REJECTED,
        SYSTEM_ACTOR_ID,
        this.orgId,
      );

      await ctx.answerCbQuery('Quotation rejected.');
      await ctx.editMessageReplyMarkup(undefined);
    } catch (err) {
      this.logger.error(`reject action error: ${err.message}`);
      await ctx.answerCbQuery('Failed to reject quotation.');
    }
  }

  @Action(/^approve:review:(.+)$/)
  async onApproveReview(@Ctx() ctx: Context) {
    try {
      const data = (ctx.callbackQuery as any)?.data || '';
      const reviewId = data.split(':')[2];

      await this.reviewsService.approve(reviewId, SYSTEM_ACTOR_ID, this.orgId);

      await ctx.answerCbQuery('Review approved!');
      await ctx.editMessageReplyMarkup(undefined);
    } catch (err) {
      this.logger.error(`approve review error: ${err.message}`);
      await ctx.answerCbQuery('Failed to approve review.');
    }
  }

  @Action(/^reject:review:(.+)$/)
  async onRejectReview(@Ctx() ctx: Context) {
    try {
      const data = (ctx.callbackQuery as any)?.data || '';
      const reviewId = data.split(':')[2];

      await this.reviewsService.reject(reviewId, SYSTEM_ACTOR_ID, this.orgId, {
        reviewerNotes: 'Rejected via Telegram',
      });

      await ctx.answerCbQuery('Review rejected.');
      await ctx.editMessageReplyMarkup(undefined);
    } catch (err) {
      this.logger.error(`reject review error: ${err.message}`);
      await ctx.answerCbQuery('Failed to reject review.');
    }
  }
}
