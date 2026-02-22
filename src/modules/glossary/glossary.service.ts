import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { GlossaryTerm } from '../../database/entities/glossary-term.entity';
import { CreateGlossaryTermDto } from './dto/create-glossary-term.dto';
import { UpdateGlossaryTermDto } from './dto/update-glossary-term.dto';
import { ImportGlossaryDto } from './dto/import-glossary.dto';

@Injectable()
export class GlossaryService {
  constructor(
    @InjectRepository(GlossaryTerm)
    private glossaryRepository: Repository<GlossaryTerm>,
  ) {}

  async create(organizationId: string, dto: CreateGlossaryTermDto, userId: string) {
    const existing = await this.glossaryRepository.findOne({
      where: { organizationId, sourceTerm: dto.sourceTerm },
    });
    if (existing) {
      throw new ConflictException(`Glossary term "${dto.sourceTerm}" already exists`);
    }

    const term = this.glossaryRepository.create({
      ...dto,
      organizationId,
      createdBy: userId,
    });
    return this.glossaryRepository.save(term);
  }

  async findAll(organizationId: string, category?: string, search?: string) {
    const where: any = { organizationId };
    if (category) where.category = category;
    if (search) where.sourceTerm = Like(`%${search}%`);

    return this.glossaryRepository.find({
      where,
      order: { sourceTerm: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const term = await this.glossaryRepository.findOne({
      where: { id, organizationId },
    });
    if (!term) throw new NotFoundException('Glossary term not found');
    return term;
  }

  async update(id: string, organizationId: string, dto: UpdateGlossaryTermDto) {
    const term = await this.findOne(id, organizationId);
    Object.assign(term, dto);
    return this.glossaryRepository.save(term);
  }

  async remove(id: string, organizationId: string) {
    const term = await this.findOne(id, organizationId);
    return this.glossaryRepository.remove(term);
  }

  async getGlossaryForCategory(organizationId: string, category?: string): Promise<GlossaryTerm[]> {
    const where: any = { organizationId };
    if (category) {
      return this.glossaryRepository.find({
        where: [
          { organizationId, category },
          { organizationId, category: null as any },
        ],
        order: { sourceTerm: 'ASC' },
      });
    }
    return this.glossaryRepository.find({ where, order: { sourceTerm: 'ASC' } });
  }

  async importTerms(organizationId: string, dto: ImportGlossaryDto, userId: string) {
    const results = { created: 0, updated: 0, skipped: 0 };

    for (const termDto of dto.terms) {
      const existing = await this.glossaryRepository.findOne({
        where: { organizationId, sourceTerm: termDto.sourceTerm },
      });

      if (existing) {
        if (dto.upsert) {
          Object.assign(existing, {
            targetTerm: termDto.targetTerm,
            sourceLanguage: termDto.sourceLanguage || existing.sourceLanguage,
            targetLanguage: termDto.targetLanguage || existing.targetLanguage,
            category: termDto.category ?? existing.category,
          });
          await this.glossaryRepository.save(existing);
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await this.glossaryRepository.save(
          this.glossaryRepository.create({
            ...termDto,
            organizationId,
            createdBy: userId,
          }),
        );
        results.created++;
      }
    }

    return results;
  }

  async exportTerms(organizationId: string, category?: string) {
    const terms = await this.getGlossaryForCategory(organizationId, category);
    return terms.map((t) => ({
      sourceTerm: t.sourceTerm,
      targetTerm: t.targetTerm,
      sourceLanguage: t.sourceLanguage,
      targetLanguage: t.targetLanguage,
      category: t.category,
    }));
  }
}
