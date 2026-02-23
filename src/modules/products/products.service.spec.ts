import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from '../../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const PRODUCT_ID = 'product-uuid-1';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: PRODUCT_ID,
  organizationId: ORG_ID,
  name: 'Thiet ke website',
  description: 'Thiet ke website responsive, SEO friendly',
  unit: 'goi',
  defaultPrice: 15000000,
  category: 'Web Development',
  isActive: true,
  currencyId: null,
  createdBy: USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
} as Product);

describe('ProductsService', () => {
  let service: ProductsService;
  let mockRepo: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockRepo = {
      create: jest.fn((data) => ({ id: PRODUCT_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('should create a product with the given organizationId and userId', async () => {
      const createDto: CreateProductDto = {
        name: 'Thiet ke website',
        unit: 'goi',
        defaultPrice: 15000000,
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

    it('should return the saved product entity', async () => {
      const createDto: CreateProductDto = {
        name: 'SEO Package',
        unit: 'thang',
        defaultPrice: 5000000,
      };
      const savedProduct = makeProduct({ name: 'SEO Package' });
      mockRepo.save.mockResolvedValue(savedProduct);

      const result = await service.create(createDto, USER_ID, ORG_ID);

      expect(result).toEqual(savedProduct);
    });

    it('should create a product with optional fields', async () => {
      const createDto: CreateProductDto = {
        name: 'Full Product',
        unit: 'cai',
        defaultPrice: 1000,
        description: 'A detailed description',
        category: 'Hardware',
      };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Full Product',
          description: 'A detailed description',
          category: 'Hardware',
          organizationId: ORG_ID,
          createdBy: USER_ID,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should scope query by organizationId', async () => {
      const queryDto: ProductQueryDto = { page: 1, limit: 20 };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'product.organizationId = :organizationId',
        { organizationId: ORG_ID },
      );
    });

    it('should always filter by isActive = true', async () => {
      const queryDto: ProductQueryDto = { page: 1, limit: 20 };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.isActive = :isActive',
        { isActive: true },
      );
    });

    it('should apply pagination using skip and take', async () => {
      const queryDto: ProductQueryDto = { page: 3, limit: 10 };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should return a PaginatedResultDto with data and total', async () => {
      const products = [makeProduct(), makeProduct({ id: 'product-uuid-2', name: 'SEO Package' })];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([products, 2]);

      const queryDto: ProductQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(queryDto, ORG_ID);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply name search filter when search is provided', async () => {
      const queryDto: ProductQueryDto = { page: 1, limit: 20, search: 'website' };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.name ILIKE :search',
        { search: '%website%' },
      );
    });

    it('should apply category filter when category is provided', async () => {
      const queryDto: ProductQueryDto = { page: 1, limit: 20, category: 'Web Development' };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.category = :category',
        { category: 'Web Development' },
      );
    });

    it('should not apply search or category filters when they are not provided', async () => {
      const queryDto: ProductQueryDto = { page: 1, limit: 20 };

      await service.findAll(queryDto, ORG_ID);

      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls.map((c) => c[0] as string);
      const hasSearch = andWhereCalls.some((call) => call.includes('ILIKE'));
      const hasCategory = andWhereCalls.some((call) => call.includes('category ='));
      expect(hasSearch).toBe(false);
      expect(hasCategory).toBe(false);
    });

    it('should apply both search and category filters together', async () => {
      const queryDto: ProductQueryDto = {
        page: 1,
        limit: 20,
        search: 'website',
        category: 'Web Development',
      };

      await service.findAll(queryDto, ORG_ID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.name ILIKE :search',
        { search: '%website%' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.category = :category',
        { category: 'Web Development' },
      );
    });

    it('should return empty data when no products match', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const queryDto: ProductQueryDto = { page: 1, limit: 20, search: 'nonexistent' };

      const result = await service.findAll(queryDto, ORG_ID);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      const products = Array.from({ length: 10 }, (_, i) =>
        makeProduct({ id: `product-uuid-${i}` }),
      );
      mockQueryBuilder.getManyAndCount.mockResolvedValue([products, 50]);

      const queryDto: ProductQueryDto = { page: 1, limit: 10 };
      const result = await service.findAll(queryDto, ORG_ID);

      expect(result.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return a product when found by id and organizationId', async () => {
      const product = makeProduct();
      mockRepo.findOne.mockResolvedValue(product);

      const result = await service.findOne(PRODUCT_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID, organizationId: ORG_ID },
      });
      expect(result).toEqual(product);
    });

    it('should query without organizationId when it is not provided', async () => {
      const product = makeProduct();
      mockRepo.findOne.mockResolvedValue(product);

      await service.findOne(PRODUCT_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
      });
    });

    it('should throw NotFoundException when product is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(PRODUCT_ID, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(PRODUCT_ID, ORG_ID)).rejects.toThrow(
        'Product not found',
      );
    });

    it('should throw NotFoundException when querying a different organization\'s product', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(PRODUCT_ID, 'other-org-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update product fields and return saved entity', async () => {
      const existingProduct = makeProduct();
      mockRepo.findOne.mockResolvedValue(existingProduct);

      const updateDto: UpdateProductDto = {
        name: 'Updated Product',
        defaultPrice: 20000000,
      };

      const updatedProduct = { ...existingProduct, ...updateDto };
      mockRepo.save.mockResolvedValue(updatedProduct);

      const result = await service.update(PRODUCT_ID, updateDto, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Product', defaultPrice: 20000000 }),
      );
      expect(result.name).toBe('Updated Product');
      expect(result.defaultPrice).toBe(20000000);
    });

    it('should throw NotFoundException when updating a non-existent product', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateProductDto = { name: 'Does Not Matter' };

      await expect(service.update('non-existent-id', updateDto, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow toggling isActive field', async () => {
      const existingProduct = makeProduct({ isActive: true });
      mockRepo.findOne.mockResolvedValue(existingProduct);

      const updateDto: UpdateProductDto = { isActive: false };
      mockRepo.save.mockResolvedValue({ ...existingProduct, isActive: false });

      const result = await service.update(PRODUCT_ID, updateDto, ORG_ID);

      expect(result.isActive).toBe(false);
    });

    it('should preserve unchanged fields during update', async () => {
      const existingProduct = makeProduct({ unit: 'cai', category: 'Hardware' });
      mockRepo.findOne.mockResolvedValue(existingProduct);

      const updateDto: UpdateProductDto = { name: 'New Name' };
      mockRepo.save.mockResolvedValue({ ...existingProduct, name: 'New Name' });

      const result = await service.update(PRODUCT_ID, updateDto, ORG_ID);

      expect(result.unit).toBe('cai');
      expect(result.category).toBe('Hardware');
    });
  });

  describe('remove', () => {
    it('should remove the product (hard delete)', async () => {
      const product = makeProduct();
      mockRepo.findOne.mockResolvedValue(product);

      await service.remove(PRODUCT_ID, ORG_ID);

      expect(mockRepo.remove).toHaveBeenCalledWith(product);
    });

    it('should throw NotFoundException when removing a non-existent product', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return void on successful removal', async () => {
      const product = makeProduct();
      mockRepo.findOne.mockResolvedValue(product);

      const result = await service.remove(PRODUCT_ID, ORG_ID);

      expect(result).toBeUndefined();
    });
  });
});
