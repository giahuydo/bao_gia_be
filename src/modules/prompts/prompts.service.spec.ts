import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { AiPromptVersion, PromptType } from '../../database/entities/ai-prompt-version.entity';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

const USER_ID = 'user-uuid-1';
const PROMPT_ID = 'prompt-uuid-1';

const makePrompt = (overrides: Partial<AiPromptVersion> = {}): AiPromptVersion => ({
  id: PROMPT_ID,
  type: PromptType.EXTRACT,
  versionNumber: 1,
  systemPrompt: 'You are a document extraction assistant.',
  userPromptTemplate: 'Extract data from: {{document}}',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  isActive: false,
  changeNotes: null,
  createdBy: USER_ID,
  createdAt: new Date('2024-01-01'),
  ...overrides,
} as AiPromptVersion);

describe('PromptsService', () => {
  let service: PromptsService;
  let mockRepo: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: null }),
    };

    mockRepo = {
      create: jest.fn((data) => ({ id: PROMPT_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        { provide: getRepositoryToken(AiPromptVersion), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  describe('create', () => {
    it('should create a prompt with version number 1 when no prior versions exist', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: null });

      const dto: CreatePromptDto = {
        type: PromptType.EXTRACT,
        systemPrompt: 'System instructions',
        userPromptTemplate: 'User template: {{input}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
      };

      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create(dto, USER_ID);

      expect(result.versionNumber).toBe(1);
      expect(result.isActive).toBe(false);
      expect(result.createdBy).toBe(USER_ID);
    });

    it('should increment version number based on the max existing version', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: 4 });

      const dto: CreatePromptDto = {
        type: PromptType.GENERATE,
        systemPrompt: 'Generate quotation system prompt',
        userPromptTemplate: 'Generate from: {{specs}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
      };

      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create(dto, USER_ID);

      expect(result.versionNumber).toBe(5);
    });

    it('should always create with isActive = false', async () => {
      const dto: CreatePromptDto = {
        type: PromptType.TRANSLATE,
        systemPrompt: 'Translate prompt',
        userPromptTemplate: 'Translate: {{text}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
      };

      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create(dto, USER_ID);

      expect(result.isActive).toBe(false);
    });

    it('should query max version by type', async () => {
      const dto: CreatePromptDto = {
        type: PromptType.COMPARE,
        systemPrompt: 'Compare prompt',
        userPromptTemplate: 'Compare: {{a}} vs {{b}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
      };

      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.create(dto, USER_ID);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('p.type = :type', { type: PromptType.COMPARE });
    });

    it('should store changeNotes when provided', async () => {
      const dto: CreatePromptDto = {
        type: PromptType.IMPROVE,
        systemPrompt: 'Improve system prompt',
        userPromptTemplate: 'Improve: {{text}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        changeNotes: 'Added better context handling',
      };

      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create(dto, USER_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ changeNotes: 'Added better context handling' }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all prompts when no type filter is provided', async () => {
      const prompts = [makePrompt(), makePrompt({ id: 'prompt-uuid-2', type: PromptType.GENERATE })];
      mockRepo.find.mockResolvedValue(prompts);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { type: 'ASC', versionNumber: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by type when provided', async () => {
      const prompts = [makePrompt()];
      mockRepo.find.mockResolvedValue(prompts);

      await service.findAll(PromptType.EXTRACT);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { type: PromptType.EXTRACT },
        order: { type: 'ASC', versionNumber: 'DESC' },
      });
    });

    it('should return empty array when no prompts exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a prompt when found by id', async () => {
      const prompt = makePrompt();
      mockRepo.findOne.mockResolvedValue(prompt);

      const result = await service.findOne(PROMPT_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: PROMPT_ID } });
      expect(result).toEqual(prompt);
    });

    it('should throw NotFoundException when prompt is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(PROMPT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(PROMPT_ID)).rejects.toThrow('Prompt version not found');
    });
  });

  describe('update', () => {
    it('should update an inactive prompt and return the saved entity', async () => {
      const existingPrompt = makePrompt({ isActive: false });
      mockRepo.findOne.mockResolvedValue(existingPrompt);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: UpdatePromptDto = { systemPrompt: 'Updated system prompt' };
      const result = await service.update(PROMPT_ID, dto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ systemPrompt: 'Updated system prompt' }),
      );
      expect(result.systemPrompt).toBe('Updated system prompt');
    });

    it('should preserve unchanged fields during update', async () => {
      const existingPrompt = makePrompt({
        isActive: false,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
      });
      mockRepo.findOne.mockResolvedValue(existingPrompt);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: UpdatePromptDto = { systemPrompt: 'New instructions' };
      const result = await service.update(PROMPT_ID, dto);

      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.maxTokens).toBe(8192);
    });

    it('should throw BadRequestException when trying to edit an active prompt', async () => {
      const activePrompt = makePrompt({ isActive: true });
      mockRepo.findOne.mockResolvedValue(activePrompt);

      const dto: UpdatePromptDto = { systemPrompt: 'Trying to edit active' };
      await expect(service.update(PROMPT_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.update(PROMPT_ID, dto)).rejects.toThrow(
        'Cannot edit an active prompt version. Create a new version instead.',
      );
    });

    it('should throw NotFoundException when prompt to update does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const dto: UpdatePromptDto = { systemPrompt: 'Some update' };
      await expect(service.update('non-existent-id', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should activate a prompt and deactivate other active versions of same type', async () => {
      const inactivePrompt = makePrompt({ isActive: false, type: PromptType.EXTRACT });
      mockRepo.findOne.mockResolvedValue(inactivePrompt);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.activate(PROMPT_ID);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { type: PromptType.EXTRACT, isActive: true },
        { isActive: false },
      );
      expect(result.isActive).toBe(true);
    });

    it('should save the prompt with isActive = true', async () => {
      const inactivePrompt = makePrompt({ isActive: false });
      mockRepo.findOne.mockResolvedValue(inactivePrompt);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.activate(PROMPT_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should deactivate others only for the same type, not other types', async () => {
      const promptToActivate = makePrompt({ isActive: false, type: PromptType.GENERATE });
      mockRepo.findOne.mockResolvedValue(promptToActivate);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.activate(PROMPT_ID);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { type: PromptType.GENERATE, isActive: true },
        { isActive: false },
      );
      expect(mockRepo.update).not.toHaveBeenCalledWith(
        { type: PromptType.EXTRACT, isActive: true },
        { isActive: false },
      );
    });

    it('should throw NotFoundException when prompt to activate does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.activate('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should return the activated prompt', async () => {
      const inactivePrompt = makePrompt({ isActive: false });
      mockRepo.findOne.mockResolvedValue(inactivePrompt);
      const activatedPrompt = { ...inactivePrompt, isActive: true };
      mockRepo.save.mockResolvedValue(activatedPrompt);

      const result = await service.activate(PROMPT_ID);

      expect(result.isActive).toBe(true);
    });
  });

  describe('getActivePrompt', () => {
    it('should return the active prompt for a given type', async () => {
      const activePrompt = makePrompt({ isActive: true, type: PromptType.EXTRACT });
      mockRepo.findOne.mockResolvedValue(activePrompt);

      const result = await service.getActivePrompt(PromptType.EXTRACT);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { type: PromptType.EXTRACT, isActive: true },
      });
      expect(result).toEqual(activePrompt);
      expect(result!.isActive).toBe(true);
    });

    it('should return null when no active prompt exists for the type', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getActivePrompt(PromptType.GENERATE);

      expect(result).toBeNull();
    });

    it('should cache the active prompt after first lookup', async () => {
      const activePrompt = makePrompt({ isActive: true, type: PromptType.TRANSLATE });
      mockRepo.findOne.mockResolvedValue(activePrompt);

      // First call — hits the repository
      await service.getActivePrompt(PromptType.TRANSLATE);
      // Second call — should use cache
      await service.getActivePrompt(PromptType.TRANSLATE);

      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should not cache when no active prompt is found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.getActivePrompt(PromptType.SUGGEST);
      await service.getActivePrompt(PromptType.SUGGEST);

      // Both calls should hit the repo since nothing was cached
      expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after activation so next getActivePrompt fetches fresh data', async () => {
      // Seed the cache with a prompt
      const originalActive = makePrompt({ isActive: true, type: PromptType.EXTRACT });
      mockRepo.findOne.mockResolvedValueOnce(originalActive);
      await service.getActivePrompt(PromptType.EXTRACT);

      // Activate a different prompt of the same type — this invalidates the cache
      const newPrompt = makePrompt({ id: 'prompt-uuid-new', isActive: false, type: PromptType.EXTRACT });
      mockRepo.findOne.mockResolvedValue(newPrompt);
      mockRepo.save.mockImplementation((entity) => Promise.resolve({ ...entity, isActive: true }));
      await service.activate('prompt-uuid-new');

      // Now getActivePrompt should fetch from repo again (cache was invalidated)
      const freshActive = makePrompt({ id: 'prompt-uuid-new', isActive: true, type: PromptType.EXTRACT });
      mockRepo.findOne.mockResolvedValueOnce(freshActive);
      const result = await service.getActivePrompt(PromptType.EXTRACT);

      expect(result!.id).toBe('prompt-uuid-new');
    });
  });
});
