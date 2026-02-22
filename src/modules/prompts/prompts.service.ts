import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptVersion, PromptType } from '../../database/entities/ai-prompt-version.entity';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Injectable()
export class PromptsService {
  private activeCache = new Map<PromptType, AiPromptVersion>();

  constructor(
    @InjectRepository(AiPromptVersion)
    private promptRepository: Repository<AiPromptVersion>,
  ) {}

  async create(dto: CreatePromptDto, userId: string) {
    // Auto-set version number
    const maxVersion = await this.promptRepository
      .createQueryBuilder('p')
      .where('p.type = :type', { type: dto.type })
      .select('MAX(p.version_number)', 'max')
      .getRawOne();

    const versionNumber = (maxVersion?.max || 0) + 1;

    const prompt = this.promptRepository.create({
      ...dto,
      versionNumber,
      createdBy: userId,
      isActive: false,
    });
    return this.promptRepository.save(prompt);
  }

  async findAll(type?: PromptType) {
    const where: any = {};
    if (type) where.type = type;
    return this.promptRepository.find({
      where,
      order: { type: 'ASC', versionNumber: 'DESC' },
    });
  }

  async findOne(id: string) {
    const prompt = await this.promptRepository.findOne({ where: { id } });
    if (!prompt) throw new NotFoundException('Prompt version not found');
    return prompt;
  }

  async update(id: string, dto: UpdatePromptDto) {
    const prompt = await this.findOne(id);
    if (prompt.isActive) {
      throw new BadRequestException('Cannot edit an active prompt version. Create a new version instead.');
    }
    Object.assign(prompt, dto);
    return this.promptRepository.save(prompt);
  }

  async activate(id: string) {
    const prompt = await this.findOne(id);

    // Deactivate all other versions of same type
    await this.promptRepository.update(
      { type: prompt.type, isActive: true },
      { isActive: false },
    );

    prompt.isActive = true;
    const saved = await this.promptRepository.save(prompt);

    // Invalidate cache
    this.activeCache.delete(prompt.type);

    return saved;
  }

  async getActivePrompt(type: PromptType): Promise<AiPromptVersion | null> {
    if (this.activeCache.has(type)) {
      return this.activeCache.get(type)!;
    }
    const prompt = await this.promptRepository.findOne({
      where: { type, isActive: true },
    });
    if (prompt) {
      this.activeCache.set(type, prompt);
    }
    return prompt;
  }
}
