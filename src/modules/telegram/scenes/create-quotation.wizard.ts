import { Logger } from '@nestjs/common';
import { Wizard, WizardStep, Context as WizardContext, Ctx, Message } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { QuotationsService } from '../../quotations/quotations.service';
import { ConfigService } from '@nestjs/config';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

interface WizardState {
  title?: string;
  customerId?: string;
  customerName?: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}

@Wizard('create-quotation-wizard')
export class CreateQuotationWizard {
  private readonly logger = new Logger(CreateQuotationWizard.name);
  private readonly orgId: string;

  constructor(
    private telegramService: TelegramService,
    private quotationsService: QuotationsService,
    configService: ConfigService,
  ) {
    this.orgId = configService.get<string>('telegram.orgId') || '';
  }

  @WizardStep(1)
  async askTitle(@Ctx() ctx: any) {
    (ctx.wizard.state as WizardState).items = [];
    await ctx.replyWithHTML(
      [
        '<b>Create New Quotation</b> (Step 1/4)',
        '',
        'Enter the quotation <b>title</b>:',
        '<i>Example: Office Equipment Q1 2026</i>',
        '',
        'Send /cancel to abort.',
      ].join('\n'),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  async receiveTitle(@Ctx() ctx: any, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.reply('Quotation creation cancelled.');
      return ctx.scene.leave();
    }

    if (!text || text.startsWith('/')) {
      await ctx.reply('Please enter a valid title.');
      return;
    }

    (ctx.wizard.state as WizardState).title = text;

    await ctx.replyWithHTML(
      [
        '<b>Step 2/4: Customer</b>',
        '',
        'Enter <b>customer name</b> to search:',
        '',
        'Or type <b>skip</b> to create without a customer.',
      ].join('\n'),
    );
    ctx.wizard.next();
  }

  @WizardStep(3)
  async receiveCustomer(@Ctx() ctx: any, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.reply('Quotation creation cancelled.');
      return ctx.scene.leave();
    }

    if (text?.toLowerCase() !== 'skip') {
      const customers = await this.telegramService.findCustomersByName(text || '');
      if (customers.length > 0) {
        const customer = customers[0];
        (ctx.wizard.state as WizardState).customerId = customer.id;
        (ctx.wizard.state as WizardState).customerName = customer.name;
        await ctx.replyWithHTML(`Selected customer: <b>${customer.name}</b>`);
      } else {
        await ctx.reply('No customer found. Creating without customer.');
      }
    }

    await ctx.replyWithHTML(
      [
        '<b>Step 3/4: Items</b>',
        '',
        'Add items in format: <code>name | quantity | price</code>',
        '<i>Example: Laptop Dell XPS | 5 | 25000000</i>',
        '',
        'Send <b>done</b> when finished adding items.',
      ].join('\n'),
    );
    ctx.wizard.next();
  }

  @WizardStep(4)
  async receiveItems(@Ctx() ctx: any, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.reply('Quotation creation cancelled.');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as WizardState;

    if (text?.toLowerCase() === 'done') {
      if (state.items.length === 0) {
        await ctx.reply('You need at least one item. Add items or send /cancel.');
        return;
      }
      // Move to confirmation
      ctx.wizard.next();
      return this.confirmCreation(ctx);
    }

    // Parse item
    const parts = (text || '').split('|').map((s: string) => s.trim());
    if (parts.length !== 3) {
      await ctx.reply('Invalid format. Use: name | quantity | price\nExample: Laptop | 5 | 25000000');
      return;
    }

    const [name, qtyStr, priceStr] = parts;
    const quantity = parseInt(qtyStr, 10);
    const unitPrice = parseFloat(priceStr);

    if (!name || isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice < 0) {
      await ctx.reply('Invalid values. Quantity must be > 0, price must be >= 0.');
      return;
    }

    state.items.push({ name, quantity, unitPrice });
    const amount = quantity * unitPrice;
    await ctx.replyWithHTML(
      `✅ Added: <b>${name}</b> × ${quantity} = ${this.telegramService.formatCurrency(amount)}\n\nAdd more items or send <b>done</b>.`,
    );
  }

  @WizardStep(5)
  async confirmCreation(@Ctx() ctx: any) {
    const state = ctx.wizard.state as WizardState;

    const subtotal = state.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const itemLines = state.items.map(
      (i, idx) => `  ${idx + 1}. ${i.name} × ${i.quantity} = ${this.telegramService.formatCurrency(i.quantity * i.unitPrice)}`,
    );

    await ctx.replyWithHTML(
      [
        '<b>Step 4/4: Confirm</b>',
        '',
        `Title: <b>${state.title}</b>`,
        `Customer: ${state.customerName || 'None'}`,
        `Items:`,
        ...itemLines,
        `<b>Subtotal: ${this.telegramService.formatCurrency(subtotal)}</b>`,
        '',
        'Press Confirm to create, or /cancel to abort.',
      ].join('\n'),
      Markup.inlineKeyboard([
        [{ text: '✅ Confirm', callback_data: 'wizard:confirm' }],
        [{ text: '❌ Cancel', callback_data: 'wizard:cancel' }],
      ]),
    );
    ctx.wizard.next();
  }

  @WizardStep(6)
  async handleConfirmation(@Ctx() ctx: any) {
    const data = (ctx.callbackQuery as any)?.data;
    const text = (ctx.message as any)?.text;

    if (data === 'wizard:cancel' || text === '/cancel') {
      await (ctx.answerCbQuery ? ctx.answerCbQuery('Cancelled') : Promise.resolve());
      await ctx.reply('Quotation creation cancelled.');
      return ctx.scene.leave();
    }

    if (data === 'wizard:confirm') {
      try {
        await ctx.answerCbQuery('Creating...');
        const state = ctx.wizard.state as WizardState;

        const createDto = {
          title: state.title!,
          customerId: state.customerId,
          items: state.items.map((item, index) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: 'pc',
            sortOrder: index,
          })),
        } as any;

        const quotation = await this.quotationsService.create(createDto, SYSTEM_ACTOR_ID, this.orgId);

        await ctx.replyWithHTML(
          [
            '✅ <b>Quotation Created!</b>',
            '',
            this.telegramService.formatQuotation(quotation),
          ].join('\n'),
          this.telegramService.quotationKeyboard(quotation.id, quotation.status),
        );
      } catch (err) {
        this.logger.error(`Wizard create error: ${err.message}`);
        await ctx.reply(`Failed to create quotation: ${err.message}`);
      }
      return ctx.scene.leave();
    }

    await ctx.reply('Please use the buttons above, or send /cancel.');
  }
}
