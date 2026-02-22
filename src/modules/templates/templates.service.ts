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

  async create(createDto: CreateTemplateDto, userId: string): Promise<Template> {
    if (createDto.isDefault) {
      await this.templatesRepository.update({}, { isDefault: false });
    }
    const template = this.templatesRepository.create({
      ...createDto,
      createdBy: userId,
    });
    return this.templatesRepository.save(template);
  }

  async findAll(): Promise<Template[]> {
    return this.templatesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Template> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async update(id: string, updateDto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(id);
    if (updateDto.isDefault) {
      await this.templatesRepository.update({ id: Not(id) }, { isDefault: false });
    }
    Object.assign(template, updateDto);
    return this.templatesRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templatesRepository.remove(template);
  }

  async apply(id: string, applyDto: ApplyTemplateDto) {
    const template = await this.findOne(id);

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
