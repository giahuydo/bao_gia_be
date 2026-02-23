import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuotationsService } from './quotations.service';
import { Quotation, QuotationStatus } from '../../database/entities/quotation.entity';
import { QuotationItem } from '../../database/entities/quotation-item.entity';
import { QuotationHistory, HistoryAction } from '../../database/entities/quotation-history.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';

// Mock puppeteer to avoid spawning a real browser in unit tests
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock fs.readFileSync used in generatePdf
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockReturnValue('<html>{{quotationNumber}}</html>'),
}));

// Mock Handlebars to avoid template compilation issues
jest.mock('handlebars', () => ({
  registerHelper: jest.fn(),
  compile: jest.fn().mockReturnValue(jest.fn().mockReturnValue('<html>mock</html>')),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const QUOTATION_ID = 'quot-uuid-1';

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: QUOTATION_ID,
    organizationId: ORG_ID,
    quotationNumber: 'BG-20260223-001',
    title: 'Test Quotation',
    customerId: 'cust-uuid-1',
    status: QuotationStatus.DRAFT,
    validUntil: null,
    notes: null,
    terms: null,
    discount: 0,
    tax: 0,
    subtotal: 1000000,
    total: 1000000,
    currencyId: null,
    templateId: null,
    createdBy: USER_ID,
    organization: null,
    customer: { id: 'cust-uuid-1', name: 'ACME Corp' } as any,
    createdByUser: null,
    currency: null,
    template: null,
    attachments: [],
    history: [],
    versions: [],
    version: 1,
    createdAt: new Date('2026-02-23T00:00:00Z'),
    updatedAt: new Date('2026-02-23T00:00:00Z'),
    deletedAt: null,
    items: [
      {
        id: 'item-uuid-1',
        quotationId: QUOTATION_ID,
        productId: null,
        name: 'Website Design',
        description: 'UI/UX',
        unit: 'goi',
        quantity: 1,
        unitPrice: 1000000,
        amount: 1000000,
        sortOrder: 0,
      } as any,
    ],
    ...overrides,
  } as Quotation;
}

function buildQueryBuilderMock(
  overrides: Partial<Record<string, jest.Mock>> = {},
): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('QuotationsService', () => {
  let service: QuotationsService;
  let mockQuotationsRepo: Record<string, jest.Mock>;
  let mockItemsRepo: Record<string, jest.Mock>;
  let mockHistoryRepo: Record<string, jest.Mock>;
  let mockCustomersRepo: Record<string, jest.Mock>;
  let mockProductsRepo: Record<string, jest.Mock>;
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockQueryRunner: Record<string, any>;
  let mockEventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    // QueryRunner mock — returned by DataSource.createQueryRunner()
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn((EntityClass, data) => ({ ...data })),
        save: jest.fn().mockImplementation((_EntityClass, entity) =>
          Promise.resolve({ id: QUOTATION_ID, ...entity }),
        ),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockEventEmitter = { emit: jest.fn() };

    const defaultQb = buildQueryBuilderMock();

    mockQuotationsRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: QUOTATION_ID, ...entity })),
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      softRemove: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(defaultQb),
    };

    mockItemsRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockResolvedValue([]),
    };

    mockHistoryRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'hist-1', ...entity })),
    };

    mockCustomersRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    mockProductsRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: getRepositoryToken(Quotation), useValue: mockQuotationsRepo },
        { provide: getRepositoryToken(QuotationItem), useValue: mockItemsRepo },
        { provide: getRepositoryToken(QuotationHistory), useValue: mockHistoryRepo },
        { provide: getRepositoryToken(Customer), useValue: mockCustomersRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductsRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const createDto: CreateQuotationDto = {
      title: 'New Quotation',
      customerId: 'cust-uuid-1',
      discount: 10,
      tax: 5,
      items: [
        { name: 'Item A', unit: 'cai', quantity: 2, unitPrice: 500000 },
      ],
    };

    beforeEach(() => {
      // generateQuotationNumber() needs createQueryBuilder().where().orderBy().withDeleted().getOne()
      const qbForNumber = buildQueryBuilderMock({ getOne: jest.fn().mockResolvedValue(null) });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qbForNumber);

      // findOne() is called at the end of create() to return the saved quotation
      mockQuotationsRepo.findOne.mockResolvedValue(makeQuotation());
    });

    it('should connect to a transaction, commit, and return the saved quotation', async () => {
      const result = await service.create(createDto, USER_ID, ORG_ID);

      expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(QUOTATION_ID);
    });

    it('should generate a quotation number with prefix BG-<date>', async () => {
      await service.create(createDto, USER_ID, ORG_ID);

      // manager.create for Quotation should receive a quotationNumber matching BG-YYYYMMDD-NNN
      const quotationCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === Quotation,
      );
      expect(quotationCreateCalls.length).toBeGreaterThan(0);
      const quotationData = quotationCreateCalls[0][1];
      expect(quotationData.quotationNumber).toMatch(/^BG-\d{8}-\d{3}$/);
    });

    it('should calculate subtotal, discountAmount, taxAmount, and total correctly', async () => {
      // 2 * 500000 = 1000000 subtotal
      // discount 10% -> 100000 off -> 900000
      // tax 5% -> 45000 -> total 945000
      await service.create(createDto, USER_ID, ORG_ID);

      const quotationCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === Quotation,
      );
      const quotationData = quotationCreateCalls[0][1];
      expect(quotationData.subtotal).toBe(1000000);
      expect(quotationData.total).toBe(945000);
    });

    it('should create items with computed amount and default sortOrder', async () => {
      await service.create(createDto, USER_ID, ORG_ID);

      const itemCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === QuotationItem,
      );
      expect(itemCreateCalls.length).toBe(1);
      const itemData = itemCreateCalls[0][1];
      expect(itemData.amount).toBe(1000000); // 2 * 500000
      expect(itemData.sortOrder).toBe(0);
    });

    it('should save a CREATED history entry inside the transaction', async () => {
      await service.create(createDto, USER_ID, ORG_ID);

      const historySaveCalls = mockQueryRunner.manager.save.mock.calls.filter(
        ([EntityClass]) => EntityClass === QuotationHistory,
      );
      expect(historySaveCalls.length).toBe(1);
      const historyData = historySaveCalls[0][1];
      expect(historyData.action).toBe(HistoryAction.CREATED);
      expect(historyData.performedBy).toBe(USER_ID);
    });

    it('should set validUntil as a Date when provided', async () => {
      const dtoWithDate: CreateQuotationDto = {
        ...createDto,
        validUntil: '2026-12-31',
      };
      await service.create(dtoWithDate, USER_ID, ORG_ID);

      const quotationCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === Quotation,
      );
      const quotationData = quotationCreateCalls[0][1];
      expect(quotationData.validUntil).toBeInstanceOf(Date);
    });

    it('should rollback and re-throw on error', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.create(createDto, USER_ID, ORG_ID)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should increment sequence number when a previous quotation exists today', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const qbForNumber = buildQueryBuilderMock({
        getOne: jest.fn().mockResolvedValue({ quotationNumber: `BG-${today}-005` }),
      });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qbForNumber);

      await service.create(createDto, USER_ID, ORG_ID);

      const quotationCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === Quotation,
      );
      const quotationData = quotationCreateCalls[0][1];
      expect(quotationData.quotationNumber).toBe(`BG-${today}-006`);
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    let qb: ReturnType<typeof buildQueryBuilderMock>;

    beforeEach(() => {
      qb = buildQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qb);
    });

    it('should return a PaginatedResultDto with data, total, page, and limit', async () => {
      const quota = makeQuotation();
      qb.getManyAndCount.mockResolvedValue([[quota], 1]);

      const queryDto: QuotationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(queryDto, ORG_ID);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should scope results to the given organizationId', async () => {
      const queryDto: QuotationQueryDto = { page: 1, limit: 20 };
      await service.findAll(queryDto, ORG_ID);

      expect(qb.where).toHaveBeenCalledWith(
        'quotation.organizationId = :organizationId',
        { organizationId: ORG_ID },
      );
    });

    it('should apply ILIKE search on title and quotationNumber when search is provided', async () => {
      const queryDto: QuotationQueryDto = { page: 1, limit: 20, search: 'website' };
      await service.findAll(queryDto, ORG_ID);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(quotation.title ILIKE :search OR quotation.quotationNumber ILIKE :search)',
        { search: '%website%' },
      );
    });

    it('should filter by status when status is provided', async () => {
      const queryDto: QuotationQueryDto = {
        page: 1,
        limit: 20,
        status: QuotationStatus.SENT,
      };
      await service.findAll(queryDto, ORG_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('quotation.status = :status', {
        status: QuotationStatus.SENT,
      });
    });

    it('should filter by customerId when customerId is provided', async () => {
      const queryDto: QuotationQueryDto = {
        page: 1,
        limit: 20,
        customerId: 'cust-uuid-1',
      };
      await service.findAll(queryDto, ORG_ID);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'quotation.customerId = :customerId',
        { customerId: 'cust-uuid-1' },
      );
    });

    it('should apply pagination with skip and take', async () => {
      const queryDto: QuotationQueryDto = { page: 3, limit: 10 };
      await service.findAll(queryDto, ORG_ID);

      expect(qb.skip).toHaveBeenCalledWith(20); // (3 - 1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should return empty data when no quotations exist', async () => {
      const queryDto: QuotationQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(queryDto, ORG_ID);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return a quotation when found', async () => {
      const quota = makeQuotation();
      mockQuotationsRepo.findOne.mockResolvedValue(quota);

      const result = await service.findOne(QUOTATION_ID);

      expect(result).toBe(quota);
      expect(mockQuotationsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: QUOTATION_ID } }),
      );
    });

    it('should include organizationId in the where clause when provided', async () => {
      const quota = makeQuotation();
      mockQuotationsRepo.findOne.mockResolvedValue(quota);

      await service.findOne(QUOTATION_ID, ORG_ID);

      expect(mockQuotationsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: QUOTATION_ID, organizationId: ORG_ID },
        }),
      );
    });

    it('should load relations: customer, items, createdByUser, currency, attachments, history', async () => {
      const quota = makeQuotation();
      mockQuotationsRepo.findOne.mockResolvedValue(quota);

      await service.findOne(QUOTATION_ID);

      const [options] = mockQuotationsRepo.findOne.mock.calls[0];
      expect(options.relations).toEqual(
        expect.arrayContaining(['customer', 'items', 'createdByUser', 'currency', 'attachments', 'history']),
      );
    });

    it('should throw NotFoundException when quotation is not found', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow('Quotation not found');
    });
  });

  // ── update() ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    beforeEach(() => {
      // findOne() is called twice in update(): once inside the method, once for the final return
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation()) // first call inside update()
        .mockResolvedValue(makeQuotation());     // subsequent calls (final findOne)
    });

    it('should update fields and return the updated quotation', async () => {
      const updateDto: UpdateQuotationDto = { title: 'Updated Title' };
      const result = await service.update(QUOTATION_ID, updateDto, USER_ID);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Quotation,
        QUOTATION_ID,
        expect.objectContaining({ title: 'Updated Title' }),
      );
      expect(result).toBeDefined();
    });

    it('should commit the transaction on success', async () => {
      const updateDto: UpdateQuotationDto = { notes: 'Some notes' };
      await service.update(QUOTATION_ID, updateDto, USER_ID);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should delete old items and save new items when items are provided', async () => {
      const updateDto: UpdateQuotationDto = {
        items: [
          { name: 'New Item', unit: 'cai', quantity: 3, unitPrice: 200000 },
        ],
      };
      await service.update(QUOTATION_ID, updateDto, USER_ID);

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(QuotationItem, {
        quotationId: QUOTATION_ID,
      });
      const itemCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === QuotationItem,
      );
      expect(itemCreateCalls.length).toBe(1);
      expect(itemCreateCalls[0][1].amount).toBe(600000); // 3 * 200000
    });

    it('should save UPDATED history when changes are detected', async () => {
      const updateDto: UpdateQuotationDto = { title: 'Changed Title' };
      await service.update(QUOTATION_ID, updateDto, USER_ID);

      const historySaveCalls = mockQueryRunner.manager.save.mock.calls.filter(
        ([EntityClass]) => EntityClass === QuotationHistory,
      );
      expect(historySaveCalls.length).toBeGreaterThan(0);
      const historyData = historySaveCalls[0][1];
      expect(historyData.action).toBe(HistoryAction.UPDATED);
      expect(historyData.performedBy).toBe(USER_ID);
    });

    it('should recalculate subtotal and total when items are updated', async () => {
      // existing quotation has discount=10, tax=5
      mockQuotationsRepo.findOne.mockReset();
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation({ discount: 10, tax: 5 }))
        .mockResolvedValue(makeQuotation());

      const updateDto: UpdateQuotationDto = {
        items: [{ name: 'Item X', unit: 'cai', quantity: 2, unitPrice: 1000000 }],
      };
      await service.update(QUOTATION_ID, updateDto, USER_ID);

      // subtotal = 2000000, discount 10% = 200000 off = 1800000, tax 5% = 90000, total = 1890000
      expect((updateDto as any)['subtotal']).toBe(2000000);
      expect((updateDto as any)['total']).toBe(1890000);
    });

    it('should rollback and re-throw when an error occurs', async () => {
      mockQuotationsRepo.findOne.mockResolvedValueOnce(makeQuotation());
      mockQueryRunner.manager.update.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        service.update(QUOTATION_ID, { title: 'Fail' }, USER_ID),
      ).rejects.toThrow('Update failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateStatus() ──────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    beforeEach(() => {
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation({ status: QuotationStatus.DRAFT }))
        .mockResolvedValue(makeQuotation({ status: QuotationStatus.SENT }));
    });

    it('should update status to SENT and save the quotation', async () => {
      const result = await service.updateStatus(
        QUOTATION_ID,
        QuotationStatus.SENT,
        USER_ID,
        ORG_ID,
      );

      expect(mockQuotationsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: QuotationStatus.SENT }),
      );
      expect(result).toBeDefined();
    });

    it('should save a STATUS_CHANGED history entry', async () => {
      await service.updateStatus(QUOTATION_ID, QuotationStatus.SENT, USER_ID, ORG_ID);

      expect(mockHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          quotationId: QUOTATION_ID,
          action: HistoryAction.STATUS_CHANGED,
          performedBy: USER_ID,
          changes: {
            status: { from: QuotationStatus.DRAFT, to: QuotationStatus.SENT },
          },
        }),
      );
    });

    it('should emit quotation.status_changed event', async () => {
      await service.updateStatus(QUOTATION_ID, QuotationStatus.SENT, USER_ID, ORG_ID);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'quotation.status_changed',
        expect.objectContaining({
          quotationId: QUOTATION_ID,
          oldStatus: QuotationStatus.DRAFT,
          newStatus: QuotationStatus.SENT,
          changedBy: USER_ID,
        }),
      );
    });

    it('should throw NotFoundException when the quotation does not exist', async () => {
      mockQuotationsRepo.findOne.mockReset();
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', QuotationStatus.SENT, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should transition from SENT to ACCEPTED', async () => {
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation({ status: QuotationStatus.SENT }))
        .mockResolvedValue(makeQuotation({ status: QuotationStatus.ACCEPTED }));

      const result = await service.updateStatus(
        QUOTATION_ID,
        QuotationStatus.ACCEPTED,
        USER_ID,
      );

      expect(mockQuotationsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: QuotationStatus.ACCEPTED }),
      );
      expect(result).toBeDefined();
    });

    it('should transition from SENT to REJECTED', async () => {
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation({ status: QuotationStatus.SENT }))
        .mockResolvedValue(makeQuotation({ status: QuotationStatus.REJECTED }));

      await service.updateStatus(QUOTATION_ID, QuotationStatus.REJECTED, USER_ID);

      expect(mockQuotationsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: QuotationStatus.REJECTED }),
      );
    });

    it('should transition from SENT to EXPIRED', async () => {
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(makeQuotation({ status: QuotationStatus.SENT }))
        .mockResolvedValue(makeQuotation({ status: QuotationStatus.EXPIRED }));

      await service.updateStatus(QUOTATION_ID, QuotationStatus.EXPIRED, USER_ID);

      expect(mockQuotationsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: QuotationStatus.EXPIRED }),
      );
    });
  });

  // ── duplicate() ─────────────────────────────────────────────────────────────

  describe('duplicate()', () => {
    const original = makeQuotation({
      quotationNumber: 'BG-20260223-001',
      title: 'Original Quotation',
      status: QuotationStatus.SENT,
    });

    beforeEach(() => {
      // generateQuotationNumber() uses createQueryBuilder — return existing number so it increments
      const qbForNumber = buildQueryBuilderMock({ getOne: jest.fn().mockResolvedValue({ quotationNumber: 'BG-20260223-001' }) });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qbForNumber);

      // findOne: first call gets the original, second call returns the new copy
      mockQuotationsRepo.findOne
        .mockResolvedValueOnce(original)
        .mockResolvedValue(
          makeQuotation({
            id: 'new-quot-uuid',
            quotationNumber: 'BG-20260223-002',
            title: 'Original Quotation (Copy)',
            status: QuotationStatus.DRAFT,
          }),
        );

      mockQuotationsRepo.save.mockResolvedValue({
        id: 'new-quot-uuid',
        quotationNumber: 'BG-20260223-002',
      });
    });

    it('should return a new quotation with status DRAFT', async () => {
      const result = await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      expect(result.status).toBe(QuotationStatus.DRAFT);
    });

    it('should generate a new quotation number', async () => {
      await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      const createCall = mockQuotationsRepo.create.mock.calls[0][0];
      expect(createCall.quotationNumber).toMatch(/^BG-\d{8}-\d{3}$/);
      expect(createCall.quotationNumber).not.toBe(original.quotationNumber);
    });

    it('should append "(Copy)" to the original title', async () => {
      await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      const createCall = mockQuotationsRepo.create.mock.calls[0][0];
      expect(createCall.title).toBe('Original Quotation (Copy)');
    });

    it('should copy all items from the original', async () => {
      await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      const createCall = mockQuotationsRepo.create.mock.calls[0][0];
      expect(createCall.items).toHaveLength(original.items.length);

      // Verify item fields are copied
      const copiedItem = createCall.items[0];
      expect(copiedItem.name).toBe(original.items[0].name);
      expect(copiedItem.unitPrice).toBe(original.items[0].unitPrice);
      expect(copiedItem.amount).toBe(original.items[0].amount);
    });

    it('should save a DUPLICATED history entry', async () => {
      await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      expect(mockHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: HistoryAction.DUPLICATED,
          performedBy: USER_ID,
          changes: expect.objectContaining({
            originalId: QUOTATION_ID,
            originalNumber: original.quotationNumber,
          }),
        }),
      );
    });

    it('should preserve customer, currency, and financial fields from original', async () => {
      await service.duplicate(QUOTATION_ID, USER_ID, ORG_ID);

      const createCall = mockQuotationsRepo.create.mock.calls[0][0];
      expect(createCall.customerId).toBe(original.customerId);
      expect(createCall.discount).toBe(original.discount);
      expect(createCall.tax).toBe(original.tax);
      expect(createCall.subtotal).toBe(original.subtotal);
      expect(createCall.total).toBe(original.total);
    });

    it('should throw NotFoundException when the original quotation does not exist', async () => {
      mockQuotationsRepo.findOne.mockReset();
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(service.duplicate('nonexistent', USER_ID, ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── remove() ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should soft-remove a quotation that exists', async () => {
      const quota = makeQuotation();
      mockQuotationsRepo.findOne.mockResolvedValue(quota);

      await service.remove(QUOTATION_ID, ORG_ID);

      expect(mockQuotationsRepo.softRemove).toHaveBeenCalledWith(quota);
    });

    it('should throw NotFoundException if the quotation does not exist', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent', ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── generatePdf() ───────────────────────────────────────────────────────────

  describe('generatePdf()', () => {
    it('should return a Buffer', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(makeQuotation());

      const result = await service.generatePdf(QUOTATION_ID);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should call findOne to retrieve the quotation', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(makeQuotation());

      await service.generatePdf(QUOTATION_ID);

      expect(mockQuotationsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: QUOTATION_ID } }),
      );
    });

    it('should throw NotFoundException when quotation does not exist', async () => {
      mockQuotationsRepo.findOne.mockResolvedValue(null);

      await expect(service.generatePdf('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── generateQuotationNumber() (private, tested via create) ──────────────────

  describe('generateQuotationNumber() (via create)', () => {
    it('should produce BG-<YYYYMMDD>-001 when no quotations exist today', async () => {
      const qbForNumber = buildQueryBuilderMock({ getOne: jest.fn().mockResolvedValue(null) });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qbForNumber);
      mockQuotationsRepo.findOne.mockResolvedValue(makeQuotation());

      const createDto: CreateQuotationDto = {
        title: 'Test',
        customerId: 'cust-1',
        items: [{ name: 'X', unit: 'cai', quantity: 1, unitPrice: 100 }],
      };

      await service.create(createDto, USER_ID, ORG_ID);

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const quotationCreateCalls = mockQueryRunner.manager.create.mock.calls.filter(
        ([EntityClass]) => EntityClass === Quotation,
      );
      const quotationData = quotationCreateCalls[0][1];
      expect(quotationData.quotationNumber).toBe(`BG-${today}-001`);
    });
  });

  // ── getDashboard() ──────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    beforeEach(() => {
      mockQuotationsRepo.count.mockResolvedValue(10);
      mockCustomersRepo.count.mockResolvedValue(5);
      mockProductsRepo.count.mockResolvedValue(20);

      const qb = buildQueryBuilderMock({
        getRawOne: jest.fn().mockResolvedValue({ totalRevenue: '5000000', acceptedRevenue: '2000000' }),
        getRawMany: jest.fn()
          .mockResolvedValueOnce([
            { status: 'draft', count: '3' },
            { status: 'sent', count: '4' },
            { status: 'accepted', count: '2' },
            { status: 'rejected', count: '1' },
          ])
          .mockResolvedValueOnce([
            {
              id: QUOTATION_ID,
              quotationNumber: 'BG-001',
              title: 'Recent Q',
              customerName: 'ACME',
              status: 'draft',
              total: '1000000',
              createdAt: new Date('2026-02-23'),
            },
          ])
          .mockResolvedValueOnce([
            { month: '2026-02', count: '3', total: '3000000' },
          ]),
      });
      mockQuotationsRepo.createQueryBuilder.mockReturnValue(qb);
    });

    it('should return dashboard stats with totalQuotations, totalCustomers, totalProducts', async () => {
      const result = await service.getDashboard(ORG_ID);

      expect(result.totalQuotations).toBe(10);
      expect(result.totalCustomers).toBe(5);
      expect(result.totalProducts).toBe(20);
    });

    it('should return parsed totalRevenue and acceptedRevenue', async () => {
      const result = await service.getDashboard(ORG_ID);

      expect(result.totalRevenue).toBe(5000000);
      expect(result.acceptedRevenue).toBe(2000000);
    });

    it('should return statusBreakdown with all statuses', async () => {
      const result = await service.getDashboard(ORG_ID);

      expect(result.statusBreakdown[QuotationStatus.DRAFT]).toBe(3);
      expect(result.statusBreakdown[QuotationStatus.SENT]).toBe(4);
      expect(result.statusBreakdown[QuotationStatus.ACCEPTED]).toBe(2);
      expect(result.statusBreakdown[QuotationStatus.REJECTED]).toBe(1);
      expect(result.statusBreakdown[QuotationStatus.EXPIRED]).toBe(0);
    });

    it('should return recentQuotations array', async () => {
      const result = await service.getDashboard(ORG_ID);

      expect(result.recentQuotations).toHaveLength(1);
      expect(result.recentQuotations[0].quotationNumber).toBe('BG-001');
    });

    it('should return monthlyTrend array', async () => {
      const result = await service.getDashboard(ORG_ID);

      expect(result.monthlyTrend).toHaveLength(1);
      expect(result.monthlyTrend[0].month).toBe('2026-02');
      expect(result.monthlyTrend[0].count).toBe(3);
      expect(result.monthlyTrend[0].total).toBe(3000000);
    });
  });
});
