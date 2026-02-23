import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from '../../database/entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const CUSTOMER_ID = 'customer-uuid-1';

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: CUSTOMER_ID,
  organizationId: ORG_ID,
  name: 'Cong ty ABC',
  email: 'contact@abc.com',
  phone: '0901234567',
  address: '123 Nguyen Hue, Q1, HCM',
  taxCode: '0123456789',
  contactPerson: 'Nguyen Van A',
  notes: 'VIP customer',
  createdBy: USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  quotations: [],
  ...overrides,
} as Customer);

describe('CustomersService', () => {
  let service: CustomersService;
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
      create: jest.fn((data) => ({ id: CUSTOMER_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('create', () => {
    it('should create a customer with the given organizationId and userId', async () => {
      const createDto: CreateCustomerDto = {
        name: 'Cong ty ABC',
        email: 'contact@abc.com',
        phone: '0901234567',
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

    it('should return the saved customer entity', async () => {
      const createDto: CreateCustomerDto = { name: 'Cong ty XYZ' };
      const savedCustomer = makeCustomer({ name: 'Cong ty XYZ' });
      mockRepo.save.mockResolvedValue(savedCustomer);

      const result = await service.create(createDto, USER_ID, ORG_ID);

      expect(result).toEqual(savedCustomer);
    });

    it('should create a customer with only a name (all optional fields omitted)', async () => {
      const createDto: CreateCustomerDto = { name: 'Minimal Customer' };

      await service.create(createDto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Customer',
          organizationId: ORG_ID,
          createdBy: USER_ID,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should scope query by organizationId', async () => {
      const pagination: PaginationDto = { page: 1, limit: 20 };

      await service.findAll(pagination, ORG_ID);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'customer.organizationId = :organizationId',
        { organizationId: ORG_ID },
      );
    });

    it('should apply pagination using skip and take', async () => {
      const pagination: PaginationDto = { page: 2, limit: 10 };

      await service.findAll(pagination, ORG_ID);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should return a PaginatedResultDto with data and total', async () => {
      const customers = [makeCustomer(), makeCustomer({ id: 'customer-uuid-2', name: 'Cong ty DEF' })];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([customers, 2]);

      const pagination: PaginationDto = { page: 1, limit: 20 };
      const result = await service.findAll(pagination, ORG_ID);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply search filter when search is provided', async () => {
      const pagination: PaginationDto = { page: 1, limit: 20, search: 'ABC' };

      await service.findAll(pagination, ORG_ID);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search)',
        { search: '%ABC%' },
      );
    });

    it('should not apply search filter when search is not provided', async () => {
      const pagination: PaginationDto = { page: 1, limit: 20 };

      await service.findAll(pagination, ORG_ID);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should return empty data when no customers exist', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const pagination: PaginationDto = { page: 1, limit: 20 };

      const result = await service.findAll(pagination, ORG_ID);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      const customers = Array.from({ length: 5 }, (_, i) =>
        makeCustomer({ id: `customer-uuid-${i}` }),
      );
      mockQueryBuilder.getManyAndCount.mockResolvedValue([customers, 25]);

      const pagination: PaginationDto = { page: 1, limit: 5 };
      const result = await service.findAll(pagination, ORG_ID);

      expect(result.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return a customer when found by id and organizationId', async () => {
      const customer = makeCustomer();
      mockRepo.findOne.mockResolvedValue(customer);

      const result = await service.findOne(CUSTOMER_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: CUSTOMER_ID, organizationId: ORG_ID },
        relations: ['createdByUser'],
      });
      expect(result).toEqual(customer);
    });

    it('should query without organizationId when it is not provided', async () => {
      const customer = makeCustomer();
      mockRepo.findOne.mockResolvedValue(customer);

      await service.findOne(CUSTOMER_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: CUSTOMER_ID },
        relations: ['createdByUser'],
      });
    });

    it('should throw NotFoundException when customer is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(CUSTOMER_ID, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(CUSTOMER_ID, ORG_ID)).rejects.toThrow(
        'Customer not found',
      );
    });

    it('should throw NotFoundException when querying a different organization\'s customer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(CUSTOMER_ID, 'other-org-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update customer fields and return saved entity', async () => {
      const existingCustomer = makeCustomer();
      mockRepo.findOne.mockResolvedValue(existingCustomer);

      const updateDto: UpdateCustomerDto = {
        name: 'Updated Company',
        phone: '0999999999',
      };

      const updatedCustomer = { ...existingCustomer, ...updateDto };
      mockRepo.save.mockResolvedValue(updatedCustomer);

      const result = await service.update(CUSTOMER_ID, updateDto, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Company', phone: '0999999999' }),
      );
      expect(result.name).toBe('Updated Company');
      expect(result.phone).toBe('0999999999');
    });

    it('should throw NotFoundException when updating a non-existent customer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateCustomerDto = { name: 'Does Not Matter' };

      await expect(service.update('non-existent-id', updateDto, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve unchanged fields during update', async () => {
      const existingCustomer = makeCustomer({ email: 'original@email.com', taxCode: '111' });
      mockRepo.findOne.mockResolvedValue(existingCustomer);

      const updateDto: UpdateCustomerDto = { name: 'New Name' };
      mockRepo.save.mockResolvedValue({ ...existingCustomer, name: 'New Name' });

      const result = await service.update(CUSTOMER_ID, updateDto, ORG_ID);

      expect(result.email).toBe('original@email.com');
      expect(result.taxCode).toBe('111');
    });
  });

  describe('remove', () => {
    it('should soft-delete the customer', async () => {
      const customer = makeCustomer();
      mockRepo.findOne.mockResolvedValue(customer);

      await service.remove(CUSTOMER_ID, ORG_ID);

      expect(mockRepo.softRemove).toHaveBeenCalledWith(customer);
    });

    it('should throw NotFoundException when removing a non-existent customer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return void on successful removal', async () => {
      const customer = makeCustomer();
      mockRepo.findOne.mockResolvedValue(customer);

      const result = await service.remove(CUSTOMER_ID, ORG_ID);

      expect(result).toBeUndefined();
    });
  });
});
