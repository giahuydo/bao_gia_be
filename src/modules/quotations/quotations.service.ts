import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { Quotation, QuotationStatus } from '../../database/entities/quotation.entity';
import { QuotationItem } from '../../database/entities/quotation-item.entity';
import { QuotationHistory, HistoryAction } from '../../database/entities/quotation-history.entity';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { PaginatedResultDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private quotationsRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private itemsRepository: Repository<QuotationItem>,
    @InjectRepository(QuotationHistory)
    private historyRepository: Repository<QuotationHistory>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreateQuotationDto, userId: string): Promise<Quotation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quotationNumber = await this.generateQuotationNumber();

      const items = createDto.items.map((item, index) => {
        const amount = item.quantity * item.unitPrice;
        return queryRunner.manager.create(QuotationItem, {
          ...item,
          amount,
          sortOrder: item.sortOrder ?? index,
        });
      });

      const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
      const discountAmount = subtotal * (createDto.discount || 0) / 100;
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (createDto.tax || 0) / 100;
      const total = afterDiscount + taxAmount;

      const quotationData: any = {
        quotationNumber,
        title: createDto.title,
        customerId: createDto.customerId,
        notes: createDto.notes,
        terms: createDto.terms,
        discount: createDto.discount || 0,
        tax: createDto.tax || 0,
        subtotal,
        total,
        templateId: createDto.templateId,
        createdBy: userId,
        items,
      };
      if (createDto.validUntil) {
        quotationData.validUntil = new Date(createDto.validUntil);
      }
      const quotation = queryRunner.manager.create(Quotation, quotationData);

      const saved = await queryRunner.manager.save(Quotation, quotation);

      await queryRunner.manager.save(QuotationHistory, {
        quotationId: saved.id,
        action: HistoryAction.CREATED,
        performedBy: userId,
        note: `Quotation ${quotationNumber} created`,
      });

      await queryRunner.commitTransaction();

      return this.findOne(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(queryDto: QuotationQueryDto): Promise<PaginatedResultDto<Quotation>> {
    const { page, limit, search, status, customerId } = queryDto;
    const qb = this.quotationsRepository.createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .leftJoinAndSelect('quotation.items', 'items')
      .leftJoinAndSelect('quotation.currency', 'currency');

    if (search) {
      qb.andWhere(
        '(quotation.title ILIKE :search OR quotation.quotationNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      qb.andWhere('quotation.status = :status', { status });
    }

    if (customerId) {
      qb.andWhere('quotation.customerId = :customerId', { customerId });
    }

    qb.orderBy('quotation.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Quotation> {
    const quotation = await this.quotationsRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'createdByUser', 'currency', 'attachments', 'history', 'history.performedByUser'],
      order: { items: { sortOrder: 'ASC' }, history: { createdAt: 'DESC' } },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }
    return quotation;
  }

  async update(id: string, updateDto: UpdateQuotationDto, userId: string): Promise<Quotation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quotation = await this.findOne(id);
      const changes: Record<string, any> = {};

      if (updateDto.items) {
        await queryRunner.manager.delete(QuotationItem, { quotationId: id });

        const items = updateDto.items.map((item, index) => {
          const amount = item.quantity * item.unitPrice;
          return queryRunner.manager.create(QuotationItem, {
            ...item,
            quotationId: id,
            amount,
            sortOrder: item.sortOrder ?? index,
          });
        });
        await queryRunner.manager.save(QuotationItem, items);

        const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
        const discount = updateDto.discount ?? quotation.discount;
        const tax = updateDto.tax ?? quotation.tax;
        const discountAmount = subtotal * Number(discount) / 100;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * Number(tax) / 100;
        const total = afterDiscount + taxAmount;

        updateDto['subtotal'] = subtotal;
        updateDto['total'] = total;
        changes.items = 'updated';
      }

      const { items, ...updateData } = updateDto;

      for (const [key, value] of Object.entries(updateData)) {
        if (quotation[key] !== value) {
          changes[key] = { from: quotation[key], to: value };
        }
      }

      await queryRunner.manager.update(Quotation, id, updateData);

      if (Object.keys(changes).length > 0) {
        await queryRunner.manager.save(QuotationHistory, {
          quotationId: id,
          action: HistoryAction.UPDATED,
          changes,
          performedBy: userId,
          note: `Quotation updated`,
        });
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const quotation = await this.findOne(id);
    await this.quotationsRepository.softRemove(quotation);
  }

  async updateStatus(id: string, status: QuotationStatus, userId: string): Promise<Quotation> {
    const quotation = await this.findOne(id);
    const oldStatus = quotation.status;
    quotation.status = status;
    await this.quotationsRepository.save(quotation);

    await this.historyRepository.save({
      quotationId: id,
      action: HistoryAction.STATUS_CHANGED,
      changes: { status: { from: oldStatus, to: status } },
      performedBy: userId,
      note: `Status changed from ${oldStatus} to ${status}`,
    });

    return this.findOne(id);
  }

  async duplicate(id: string, userId: string): Promise<Quotation> {
    const original = await this.findOne(id);
    const quotationNumber = await this.generateQuotationNumber();

    const newQuotation = this.quotationsRepository.create({
      quotationNumber,
      title: `${original.title} (Copy)`,
      customerId: original.customerId,
      status: QuotationStatus.DRAFT,
      validUntil: original.validUntil,
      notes: original.notes,
      terms: original.terms,
      discount: original.discount,
      tax: original.tax,
      subtotal: original.subtotal,
      total: original.total,
      currencyId: original.currencyId,
      templateId: original.templateId,
      createdBy: userId,
      items: original.items.map((item) =>
        this.itemsRepository.create({
          productId: item.productId,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: item.sortOrder,
        }),
      ),
    });

    const saved = await this.quotationsRepository.save(newQuotation);

    await this.historyRepository.save({
      quotationId: saved.id,
      action: HistoryAction.DUPLICATED,
      performedBy: userId,
      note: `Duplicated from ${original.quotationNumber}`,
      changes: { originalId: id, originalNumber: original.quotationNumber },
    });

    return this.findOne(saved.id);
  }

  async generatePdf(id: string): Promise<Buffer> {
    const quotation = await this.findOne(id);

    const templatePath = path.join(process.cwd(), 'templates', 'quotation-pdf.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf-8');

    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    });

    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      if (amount == null) return '0 VND';
      return Number(amount).toLocaleString('vi-VN') + ' VND';
    });

    Handlebars.registerHelper('formatNumber', (num: number) => {
      if (num == null) return '0';
      return Number(num).toLocaleString('vi-VN');
    });

    Handlebars.registerHelper('add', (a: number, b: number) => a + b);

    const template = Handlebars.compile(templateSource);

    const subtotal = Number(quotation.subtotal);
    const discount = Number(quotation.discount);
    const tax = Number(quotation.tax);
    const discountAmount = subtotal * discount / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * tax / 100;

    const html = template({
      ...quotation,
      discountAmount,
      taxAmount,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private async generateQuotationNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `BG-${dateStr}`;

    const lastQuotation = await this.quotationsRepository
      .createQueryBuilder('q')
      .where('q.quotationNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('q.quotationNumber', 'DESC')
      .withDeleted()
      .getOne();

    let sequence = 1;
    if (lastQuotation) {
      const lastSeq = parseInt(lastQuotation.quotationNumber.split('-')[2], 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }
}
