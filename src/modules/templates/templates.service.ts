import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Template } from '../../database/entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templatesRepository: Repository<Template>,
  ) {}

  async create(createDto: CreateTemplateDto, userId: string, organizationId: string): Promise<Template> {
    if (createDto.isDefault) {
      await this.templatesRepository.update({ organizationId }, { isDefault: false });
    }
    const template = this.templatesRepository.create({
      ...createDto,
      createdBy: userId,
      organizationId,
    });
    return this.templatesRepository.save(template);
  }

  async findAll(organizationId: string): Promise<Template[]> {
    return this.templatesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId?: string): Promise<Template> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const template = await this.templatesRepository.findOne({ where });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async update(id: string, updateDto: UpdateTemplateDto, organizationId: string): Promise<Template> {
    const template = await this.findOne(id, organizationId);
    if (updateDto.isDefault) {
      await this.templatesRepository.update({ organizationId, id: Not(id) }, { isDefault: false });
    }
    Object.assign(template, updateDto);
    return this.templatesRepository.save(template);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const template = await this.findOne(id, organizationId);
    await this.templatesRepository.remove(template);
  }

  async apply(id: string, applyDto: ApplyTemplateDto, organizationId?: string) {
    const template = await this.findOne(id, organizationId);

    return {
      title: applyDto.title || `Bao gia tu template: ${template.name}`,
      customerId: applyDto.customerId || null,
      terms: template.defaultTerms,
      notes: template.defaultNotes,
      tax: template.defaultTax,
      discount: template.defaultDiscount,
      items: (template.items || []).map((item: any, index: number) => ({
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
        sortOrder: index,
      })),
    };
  }
}
