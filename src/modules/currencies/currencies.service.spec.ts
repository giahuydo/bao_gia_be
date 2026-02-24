import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { CurrenciesService } from './currencies.service';
import { Currency } from '../../database/entities/currency.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

const CURRENCY_ID = 'currency-uuid-1';
const OTHER_CURRENCY_ID = 'currency-uuid-2';

const makeCurrency = (overrides: Partial<Currency> = {}): Currency =>
  ({
    id: CURRENCY_ID,
    code: 'VND',
    name: 'Vietnamese Dong',
    symbol: '₫',
    exchangeRate: 1,
    decimalPlaces: 0,
    isDefault: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as Currency;

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: CURRENCY_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrenciesService,
        { provide: getRepositoryToken(Currency), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CurrenciesService>(CurrenciesService);
  });

  describe('findAll', () => {
    it('should return only active currencies', async () => {
      const currencies = [
        makeCurrency({ isDefault: true }),
        makeCurrency({ id: OTHER_CURRENCY_ID, code: 'USD', isDefault: false }),
      ];
      mockRepo.find.mockResolvedValue(currencies);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { isDefault: 'DESC', code: 'ASC' },
      });
      expect(result).toEqual(currencies);
    });

    it('should order by isDefault DESC then code ASC', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { isDefault: 'DESC', code: 'ASC' },
        }),
      );
    });

    it('should return an empty array when no active currencies exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a currency when found by id', async () => {
      const currency = makeCurrency();
      mockRepo.findOne.mockResolvedValue(currency);

      const result = await service.findOne(CURRENCY_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: CURRENCY_ID } });
      expect(result).toEqual(currency);
    });

    it('should throw NotFoundException when currency is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Currency not found');
    });
  });

  describe('findDefault', () => {
    it('should return the default currency', async () => {
      const defaultCurrency = makeCurrency({ isDefault: true });
      mockRepo.findOne.mockResolvedValue(defaultCurrency);

      const result = await service.findDefault();

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { isDefault: true } });
      expect(result.isDefault).toBe(true);
    });

    it('should throw NotFoundException when no default currency is configured', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findDefault()).rejects.toThrow(NotFoundException);
      await expect(service.findDefault()).rejects.toThrow('No default currency configured');
    });
  });

  describe('create', () => {
    it('should create a currency with provided data', async () => {
      const createDto: CreateCurrencyDto = {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        exchangeRate: 25000,
        decimalPlaces: 2,
      };
      const created = makeCurrency({ ...createDto, id: CURRENCY_ID });
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(mockRepo.create).toHaveBeenCalledWith(createDto);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.code).toBe('USD');
    });

    it('should clear all existing defaults before creating a new default currency', async () => {
      const createDto: CreateCurrencyDto = {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        isDefault: true,
      };
      mockRepo.save.mockResolvedValue(makeCurrency({ ...createDto }));

      await service.create(createDto);

      expect(mockRepo.update).toHaveBeenCalledWith({}, { isDefault: false });
    });

    it('should NOT clear existing defaults when isDefault is false', async () => {
      const createDto: CreateCurrencyDto = {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        isDefault: false,
      };
      mockRepo.save.mockResolvedValue(makeCurrency({ ...createDto }));

      await service.create(createDto);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should NOT clear existing defaults when isDefault is omitted', async () => {
      const createDto: CreateCurrencyDto = {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
      };
      mockRepo.save.mockResolvedValue(makeCurrency({ ...createDto }));

      await service.create(createDto);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should return the saved currency entity', async () => {
      const createDto: CreateCurrencyDto = { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' };
      const saved = makeCurrency();
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(createDto);

      expect(result).toEqual(saved);
    });
  });

  describe('update', () => {
    it('should update currency fields and return the saved entity', async () => {
      const existing = makeCurrency();
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCurrencyDto = { name: 'Dong Viet Nam', exchangeRate: 1.5 };
      const updated = { ...existing, ...updateDto };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(CURRENCY_ID, updateDto);

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dong Viet Nam' }));
      expect(result.name).toBe('Dong Viet Nam');
    });

    it('should clear other currencies default flag when setting a new default', async () => {
      const existing = makeCurrency({ isDefault: false });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCurrencyDto = { isDefault: true };
      mockRepo.save.mockResolvedValue({ ...existing, isDefault: true });

      await service.update(CURRENCY_ID, updateDto);

      expect(mockRepo.update).toHaveBeenCalledWith({ id: Not(CURRENCY_ID) }, { isDefault: false });
    });

    it('should NOT clear other currencies default flag when isDefault is false', async () => {
      const existing = makeCurrency({ isDefault: true });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCurrencyDto = { name: 'Updated Name', isDefault: false };
      mockRepo.save.mockResolvedValue({ ...existing, ...updateDto });

      await service.update(CURRENCY_ID, updateDto);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when currency to update is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve unchanged fields during update', async () => {
      const existing = makeCurrency({ code: 'VND', symbol: '₫', exchangeRate: 1 });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateCurrencyDto = { name: 'New Name' };
      mockRepo.save.mockResolvedValue({ ...existing, name: 'New Name' });

      const result = await service.update(CURRENCY_ID, updateDto);

      expect(result.code).toBe('VND');
      expect(result.symbol).toBe('₫');
      expect(result.exchangeRate).toBe(1);
    });
  });

  describe('remove', () => {
    it('should set isActive to false (soft deactivate) instead of deleting', async () => {
      const currency = makeCurrency({ isActive: true });
      mockRepo.findOne.mockResolvedValue(currency);

      await service.remove(CURRENCY_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException when currency to remove is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should return void on successful deactivation', async () => {
      const currency = makeCurrency();
      mockRepo.findOne.mockResolvedValue(currency);
      mockRepo.save.mockResolvedValue({ ...currency, isActive: false });

      const result = await service.remove(CURRENCY_ID);

      expect(result).toBeUndefined();
    });

    it('should NOT use a hard delete operation', async () => {
      const currency = makeCurrency();
      mockRepo.findOne.mockResolvedValue(currency);

      await service.remove(CURRENCY_ID);

      expect(mockRepo.delete).toBeUndefined();
      expect(mockRepo.remove).toBeUndefined();
    });
  });
});
