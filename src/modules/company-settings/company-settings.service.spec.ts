import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettings } from '../../database/entities/company-settings.entity';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

const ORG_ID = 'org-uuid-1';
const SETTINGS_ID = 'settings-uuid-1';

const makeSettings = (overrides: Partial<CompanySettings> = {}): CompanySettings =>
  ({
    id: SETTINGS_ID,
    organizationId: ORG_ID,
    companyName: 'My Company',
    companyNameEn: null,
    taxCode: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    logoUrl: null,
    bankName: null,
    bankAccount: null,
    bankBranch: null,
    quotationPrefix: 'BG',
    quotationTerms: null,
    quotationNotes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as CompanySettings;

describe('CompanySettingsService', () => {
  let service: CompanySettingsService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: SETTINGS_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySettingsService,
        { provide: getRepositoryToken(CompanySettings), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CompanySettingsService>(CompanySettingsService);
  });

  describe('get', () => {
    it('should return existing settings when found by organizationId', async () => {
      const existing = makeSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.get(ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { organizationId: ORG_ID } });
      expect(result).toEqual(existing);
    });

    it('should create and return default settings when none exist for the organization', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const defaultSettings = makeSettings();
      mockRepo.save.mockResolvedValue(defaultSettings);

      const result = await service.get(ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith({
        companyName: 'My Company',
        quotationPrefix: 'BG',
        organizationId: ORG_ID,
      });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toEqual(defaultSettings);
    });

    it('should scope settings lookup by organizationId', async () => {
      const otherOrgId = 'org-uuid-2';
      const otherSettings = makeSettings({ organizationId: otherOrgId });
      mockRepo.findOne.mockResolvedValue(otherSettings);

      const result = await service.get(otherOrgId);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { organizationId: otherOrgId } });
      expect(result.organizationId).toBe(otherOrgId);
    });

    it('should create default settings with companyName "My Company" and prefix "BG"', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = makeSettings();
      mockRepo.save.mockResolvedValue(created);

      const result = await service.get(ORG_ID);

      expect(result.companyName).toBe('My Company');
      expect(result.quotationPrefix).toBe('BG');
    });

    it('should not call create when settings already exist', async () => {
      const existing = makeSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      await service.get(ORG_ID);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update settings fields and return the saved entity', async () => {
      const existing = makeSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCompanySettingsDto = {
        companyName: 'Updated Company',
        phone: '0901234567',
        email: 'info@updated.com',
      };
      const updated = { ...existing, ...updateDto };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(updateDto, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Updated Company',
          phone: '0901234567',
          email: 'info@updated.com',
        }),
      );
      expect(result.companyName).toBe('Updated Company');
    });

    it('should create default settings first if none exist then update', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const defaultSettings = makeSettings();
      // First save (from get) returns default, second save (from update) returns updated
      mockRepo.save
        .mockResolvedValueOnce(defaultSettings)
        .mockResolvedValueOnce({ ...defaultSettings, companyName: 'New Name' });

      const updateDto: UpdateCompanySettingsDto = { companyName: 'New Name' };

      const result = await service.update(updateDto, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
      expect(result.companyName).toBe('New Name');
    });

    it('should preserve unchanged fields during update', async () => {
      const existing = makeSettings({
        taxCode: '0123456789',
        bankName: 'Vietcombank',
        quotationPrefix: 'HD',
      });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCompanySettingsDto = { companyName: 'New Name Only' };
      mockRepo.save.mockResolvedValue({ ...existing, companyName: 'New Name Only' });

      const result = await service.update(updateDto, ORG_ID);

      expect(result.taxCode).toBe('0123456789');
      expect(result.bankName).toBe('Vietcombank');
      expect(result.quotationPrefix).toBe('HD');
    });

    it('should scope the update to the correct organizationId', async () => {
      const orgASettings = makeSettings({ organizationId: ORG_ID, companyName: 'Org A' });
      mockRepo.findOne.mockResolvedValue(orgASettings);

      const updateDto: UpdateCompanySettingsDto = { companyName: 'Org A Updated' };
      mockRepo.save.mockResolvedValue({ ...orgASettings, companyName: 'Org A Updated' });

      const result = await service.update(updateDto, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { organizationId: ORG_ID } });
      expect(result.organizationId).toBe(ORG_ID);
    });

    it('should update bank information fields correctly', async () => {
      const existing = makeSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCompanySettingsDto = {
        bankName: 'Techcombank',
        bankAccount: '19034567890',
        bankBranch: 'Chi nhanh HCM',
      };
      mockRepo.save.mockResolvedValue({ ...existing, ...updateDto });

      const result = await service.update(updateDto, ORG_ID);

      expect(result.bankName).toBe('Techcombank');
      expect(result.bankAccount).toBe('19034567890');
      expect(result.bankBranch).toBe('Chi nhanh HCM');
    });

    it('should update quotation prefix and terms', async () => {
      const existing = makeSettings();
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCompanySettingsDto = {
        quotationPrefix: 'HD',
        quotationTerms: 'Payment within 30 days',
        quotationNotes: 'VAT included',
      };
      mockRepo.save.mockResolvedValue({ ...existing, ...updateDto });

      const result = await service.update(updateDto, ORG_ID);

      expect(result.quotationPrefix).toBe('HD');
      expect(result.quotationTerms).toBe('Payment within 30 days');
      expect(result.quotationNotes).toBe('VAT included');
    });
  });
});
