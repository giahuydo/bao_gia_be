import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotationVersion } from '../../database/entities/quotation-version.entity';
import { Quotation } from '../../database/entities/quotation.entity';

@Injectable()
export class VersioningService {
  constructor(
    @InjectRepository(QuotationVersion)
    private versionRepository: Repository<QuotationVersion>,
    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,
  ) {}

  async createSnapshot(quotationId: string, userId: string, orgId: string, label?: string, changeSummary?: string) {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId, organizationId: orgId },
      relations: ['items', 'customer'],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    // Determine next version number
    const lastVersion = await this.versionRepository
      .createQueryBuilder('v')
      .where('v.quotation_id = :qid', { qid: quotationId })
      .orderBy('v.version_number', 'DESC')
      .getOne();

    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    const snapshot = {
      title: quotation.title,
      status: quotation.status,
      customerId: quotation.customerId,
      items: quotation.items?.map((i) => ({
        name: i.name,
        description: i.description,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.amount,
        sortOrder: i.sortOrder,
      })),
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      tax: quotation.tax,
      total: quotation.total,
      notes: quotation.notes,
      terms: quotation.terms,
    };

    const version = this.versionRepository.create({
      quotationId,
      versionNumber,
      label: label || `v${versionNumber}`,
      snapshot,
      changeSummary,
      createdBy: userId,
    });

    return this.versionRepository.save(version);
  }

  async findAllVersions(quotationId: string, orgId: string) {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId, organizationId: orgId },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    return this.versionRepository.find({
      where: { quotationId },
      order: { versionNumber: 'DESC' },
    });
  }

  async findOneVersion(quotationId: string, versionId: string, orgId: string) {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId, organizationId: orgId },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const version = await this.versionRepository.findOne({
      where: { id: versionId, quotationId },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async compareVersions(quotationId: string, versionA: number, versionB: number, orgId: string) {
    const quotation = await this.quotationRepository.findOne({
      where: { id: quotationId, organizationId: orgId },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const [a, b] = await Promise.all([
      this.versionRepository.findOne({ where: { quotationId, versionNumber: versionA } }),
      this.versionRepository.findOne({ where: { quotationId, versionNumber: versionB } }),
    ]);
    if (!a || !b) throw new NotFoundException('One or both versions not found');

    const snapA = a.snapshot as any;
    const snapB = b.snapshot as any;

    // Compute item diff
    const itemsA = snapA.items || [];
    const itemsB = snapB.items || [];
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];

    // Index items by name for comparison
    const mapA = new Map<string, { item: any; idx: number }>(itemsA.map((item: any, idx: number) => [item.name, { item, idx }]));
    const mapB = new Map<string, { item: any; idx: number }>(itemsB.map((item: any, idx: number) => [item.name, { item, idx }]));

    for (const [name, entry] of mapB) {
      if (!mapA.has(name)) {
        added.push({ index: entry.idx, item: entry.item });
      } else {
        const aItem = mapA.get(name)!.item;
        const changes: any[] = [];
        for (const field of ['description', 'unit', 'quantity', 'unitPrice', 'amount']) {
          if (aItem[field] !== entry.item[field]) {
            changes.push({ field, from: aItem[field], to: entry.item[field] });
          }
        }
        if (changes.length > 0) {
          modified.push({ index: entry.idx, changes });
        }
      }
    }
    for (const [name, entry] of mapA) {
      if (!mapB.has(name)) {
        removed.push({ index: entry.idx, item: entry.item });
      }
    }

    // Compute totals diff
    const totals: any = {};
    for (const field of ['subtotal', 'discount', 'tax', 'total']) {
      if (snapA[field] !== snapB[field]) {
        totals[field] = { from: snapA[field], to: snapB[field] };
      }
    }

    // Compute metadata diff
    const metadata: any = {};
    for (const field of ['title', 'notes', 'terms', 'status']) {
      if (snapA[field] !== snapB[field]) {
        metadata[field] = { from: snapA[field], to: snapB[field] };
      }
    }

    return {
      versionA: { number: a.versionNumber, label: a.label, createdAt: a.createdAt },
      versionB: { number: b.versionNumber, label: b.label, createdAt: b.createdAt },
      diff: { items: { added, removed, modified }, totals, metadata },
    };
  }
}
