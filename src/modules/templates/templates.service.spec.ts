import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { TemplatesService } from './templates.service';
import { Template } from '../../database/entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';

const makeTemplate = (overrides: Partial<Template> = {}): Template =>
  ({
    id: TEMPLATE_ID,
    organizationId: ORG_ID,
    name: 'Template website co ban',
    description: 'Template danh cho du an website',
    defaultTerms: 'Thanh toan trong 30 ngay',
    defaultNotes: 'Lien he de biet them chi tiet',
    defaultTax: 10,
    defaultDiscount: 0,
    items: [
      { name: 'Thiet ke giao dien', unit: 'goi', quantity: 1, unitPrice: 15000000 },
      { name: 'Lap trinh backend', unit: 'goi', quantity: 1, unitPrice: 20000000 },
    ],
    isDefault: false,
    createdBy: USER_ID,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Template);

describe('TemplatesService', () => {
  let service: TemplatesService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ id: TEMPLATE_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: getRepositoryToken(Template), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a template with the given organizationId and userId', async () => {
      const createDto: CreateTemplateDto = {
        name: 'Template website co ban',
      };

      const result = await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: USER_ID,
        organizationId: ORG_ID,
      });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.createdBy).toBe(USER_ID);
    });

    it('should return the saved template entity', async () => {
      const createDto: CreateTemplateDto = { name: 'SEO Template' };
      const savedTemplate = makeTemplate({ name: 'SEO Template' });
      mockRepo.save.mockResolvedValue(savedTemplate);

      const result = await service.create(createDto, USER_ID, ORG_ID);

      expect(result).toEqual(savedTemplate);
    });

    it('should unset all existing default templates before saving when isDefault is true', async () => {
      const createDto: CreateTemplateDto = {
        name: 'New Default Template',
        isDefault: true,
      };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        { isDefault: false },
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should NOT call update when isDefault is false', async () => {
      const createDto: CreateTemplateDto = {
        name: 'Non-Default Template',
        isDefault: false,
      };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should NOT call update when isDefault is not provided', async () => {
      const createDto: CreateTemplateDto = { name: 'Template Without Default Flag' };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should create a template with all optional fields', async () => {
      const createDto: CreateTemplateDto = {
        name: 'Full Template',
        description: 'A full description',
        defaultTerms: 'Payment within 14 days',
        defaultNotes: 'Contact us for more info',
        defaultTax: 10,
        defaultDiscount: 5,
        isDefault: false,
        items: [{ name: 'Item A', unit: 'goi', quantity: 2, unitPrice: 5000000 }],
      };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Full Template',
          defaultTax: 10,
          defaultDiscount: 5,
          organizationId: ORG_ID,
          createdBy: USER_ID,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should scope query by organizationId and order by createdAt DESC', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findAll(ORG_ID);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return all templates for the organization', async () => {
      const templates = [
        makeTemplate({ id: 'template-uuid-1' }),
        makeTemplate({ id: 'template-uuid-2', name: 'E-commerce Template' }),
      ];
      mockRepo.find.mockResolvedValue(templates);

      const result = await service.findAll(ORG_ID);

      expect(result).toHaveLength(2);
      expect(result[0].organizationId).toBe(ORG_ID);
    });

    it('should return an empty array when no templates exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findAll(ORG_ID);

      expect(result).toEqual([]);
    });

    it('should NOT return templates from a different organization', async () => {
      const orgTemplates = [makeTemplate()];
      mockRepo.find.mockResolvedValue(orgTemplates);

      const result = await service.findAll(ORG_ID);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG_ID } }),
      );
      result.forEach((t) => expect(t.organizationId).toBe(ORG_ID));
    });
  });

  // ---------------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a template when found by id and organizationId', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.findOne(TEMPLATE_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID, organizationId: ORG_ID },
      });
      expect(result).toEqual(template);
    });

    it('should query without organizationId when it is not provided', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      await service.findOne(TEMPLATE_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID },
      });
    });

    it('should throw NotFoundException when template is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TEMPLATE_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(TEMPLATE_ID, ORG_ID)).rejects.toThrow('Template not found');
    });

    it('should throw NotFoundException when querying a different organization template', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TEMPLATE_ID, 'other-org-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update template fields and return saved entity', async () => {
      const existingTemplate = makeTemplate();
      mockRepo.findOne.mockResolvedValue(existingTemplate);

      const updateDto: UpdateTemplateDto = { name: 'Updated Template Name' };
      const updatedTemplate = { ...existingTemplate, ...updateDto };
      mockRepo.save.mockResolvedValue(updatedTemplate);

      const result = await service.update(TEMPLATE_ID, updateDto, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Template Name' }),
      );
      expect(result.name).toBe('Updated Template Name');
    });

    it('should throw NotFoundException when updating a non-existent template', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateTemplateDto = { name: 'Does Not Matter' };

      await expect(service.update('non-existent-id', updateDto, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should unset other default templates (excluding self) when isDefault is set to true', async () => {
      const existingTemplate = makeTemplate({ isDefault: false });
      mockRepo.findOne.mockResolvedValue(existingTemplate);

      const updateDto: UpdateTemplateDto = { isDefault: true };

      await service.update(TEMPLATE_ID, updateDto, ORG_ID);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { organizationId: ORG_ID, id: Not(TEMPLATE_ID) },
        { isDefault: false },
      );
    });

    it('should NOT call update on other templates when isDefault is false', async () => {
      const existingTemplate = makeTemplate();
      mockRepo.findOne.mockResolvedValue(existingTemplate);

      const updateDto: UpdateTemplateDto = { isDefault: false };

      await service.update(TEMPLATE_ID, updateDto, ORG_ID);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should NOT call update on other templates when isDefault is not provided', async () => {
      const existingTemplate = makeTemplate();
      mockRepo.findOne.mockResolvedValue(existingTemplate);

      const updateDto: UpdateTemplateDto = { name: 'Only Name Changed' };

      await service.update(TEMPLATE_ID, updateDto, ORG_ID);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should preserve unchanged fields during update', async () => {
      const existingTemplate = makeTemplate({
        defaultTax: 10,
        defaultDiscount: 5,
        defaultTerms: 'Original Terms',
      });
      mockRepo.findOne.mockResolvedValue(existingTemplate);

      const updateDto: UpdateTemplateDto = { name: 'New Name' };
      mockRepo.save.mockResolvedValue({ ...existingTemplate, name: 'New Name' });

      const result = await service.update(TEMPLATE_ID, updateDto, ORG_ID);

      expect(result.defaultTax).toBe(10);
      expect(result.defaultDiscount).toBe(5);
      expect(result.defaultTerms).toBe('Original Terms');
    });
  });

  // ---------------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should remove the template when it belongs to the organization', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      await service.remove(TEMPLATE_ID, ORG_ID);

      expect(mockRepo.remove).toHaveBeenCalledWith(template);
    });

    it('should throw NotFoundException when removing a non-existent template', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('should return void on successful removal', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.remove(TEMPLATE_ID, ORG_ID);

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // apply()
  // ---------------------------------------------------------------------------
  describe('apply', () => {
    it('should return a quotation draft built from template data', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const applyDto: ApplyTemplateDto = {};

      const result = await service.apply(TEMPLATE_ID, applyDto, ORG_ID);

      expect(result.terms).toBe(template.defaultTerms);
      expect(result.notes).toBe(template.defaultNotes);
      expect(result.tax).toBe(template.defaultTax);
      expect(result.discount).toBe(template.defaultDiscount);
    });

    it('should use provided title when given in applyDto', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const applyDto: ApplyTemplateDto = { title: 'Custom Project Quote' };

      const result = await service.apply(TEMPLATE_ID, applyDto, ORG_ID);

      expect(result.title).toBe('Custom Project Quote');
    });

    it('should generate a default title from template name when title is not provided', async () => {
      const template = makeTemplate({ name: 'Website Template' });
      mockRepo.findOne.mockResolvedValue(template);

      const applyDto: ApplyTemplateDto = {};

      const result = await service.apply(TEMPLATE_ID, applyDto, ORG_ID);

      expect(result.title).toBe('Quotation from template: Website Template');
    });

    it('should set customerId when provided in applyDto', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const applyDto: ApplyTemplateDto = { customerId: 'customer-uuid-1' };

      const result = await service.apply(TEMPLATE_ID, applyDto, ORG_ID);

      expect(result.customerId).toBe('customer-uuid-1');
    });

    it('should set customerId to null when not provided in applyDto', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const applyDto: ApplyTemplateDto = {};

      const result = await service.apply(TEMPLATE_ID, applyDto, ORG_ID);

      expect(result.customerId).toBeNull();
    });

    it('should map template items to quotation items with computed amount and sortOrder', async () => {
      const template = makeTemplate({
        items: [
          { name: 'Thiet ke giao dien', unit: 'goi', quantity: 2, unitPrice: 15000000 },
          { name: 'Lap trinh backend', description: 'API dev', unit: 'goi', quantity: 1, unitPrice: 20000000 },
        ],
      });
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.apply(TEMPLATE_ID, {}, ORG_ID);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        name: 'Thiet ke giao dien',
        unit: 'goi',
        quantity: 2,
        unitPrice: 15000000,
        amount: 30000000,
        sortOrder: 0,
      });
      expect(result.items[1]).toMatchObject({
        name: 'Lap trinh backend',
        description: 'API dev',
        amount: 20000000,
        sortOrder: 1,
      });
    });

    it('should set description to empty string for items that have no description', async () => {
      const template = makeTemplate({
        items: [{ name: 'Item Without Desc', unit: 'cai', quantity: 1, unitPrice: 1000 }],
      });
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.apply(TEMPLATE_ID, {}, ORG_ID);

      expect(result.items[0].description).toBe('');
    });

    it('should return an empty items array when the template has no items', async () => {
      const template = makeTemplate({ items: null as any });
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.apply(TEMPLATE_ID, {}, ORG_ID);

      expect(result.items).toEqual([]);
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.apply('non-existent-id', {}, ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('should respect organization scoping when applying', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      await service.apply(TEMPLATE_ID, {}, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID, organizationId: ORG_ID },
      });
    });

    it('should work without an organizationId (admin usage)', async () => {
      const template = makeTemplate();
      mockRepo.findOne.mockResolvedValue(template);

      const result = await service.apply(TEMPLATE_ID, {});

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID },
      });
      expect(result).toBeDefined();
    });
  });
});
