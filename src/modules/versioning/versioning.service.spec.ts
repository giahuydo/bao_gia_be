import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { VersioningService } from './versioning.service';
import { QuotationVersion } from '../../database/entities/quotation-version.entity';
import { Quotation, QuotationStatus } from '../../database/entities/quotation.entity';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const QUOTATION_ID = 'quotation-uuid-1';
const VERSION_ID = 'version-uuid-1';

const makeQuotation = (overrides: Partial<Quotation> = {}): Quotation => ({
  id: QUOTATION_ID,
  organizationId: ORG_ID,
  quotationNumber: 'BG-001',
  title: 'Lab Equipment Quotation',
  customerId: 'customer-uuid-1',
  status: QuotationStatus.DRAFT,
  validUntil: null,
  notes: 'Some notes',
  terms: 'Net 30',
  discount: 5,
  tax: 10,
  subtotal: 1000,
  total: 1050,
  currencyId: null,
  templateId: null,
  createdBy: USER_ID,
  items: [
    {
      id: 'item-uuid-1',
      name: 'Microscope',
      description: 'High-power microscope',
      unit: 'piece',
      quantity: 2,
      unitPrice: 500,
      amount: 1000,
      sortOrder: 1,
    } as any,
  ],
  attachments: [],
  history: [],
  versions: [],
  version: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  customer: null,
  currency: null,
  template: null,
  createdByUser: null,
  organization: null,
  ...overrides,
} as Quotation);

const makeVersion = (overrides: Partial<QuotationVersion> = {}): QuotationVersion => ({
  id: VERSION_ID,
  quotationId: QUOTATION_ID,
  versionNumber: 1,
  label: 'v1',
  snapshot: {
    title: 'Lab Equipment Quotation',
    status: QuotationStatus.DRAFT,
    customerId: 'customer-uuid-1',
    items: [
      {
        name: 'Microscope',
        description: 'High-power microscope',
        unit: 'piece',
        quantity: 2,
        unitPrice: 500,
        amount: 1000,
        sortOrder: 1,
      },
    ],
    subtotal: 1000,
    discount: 5,
    tax: 10,
    total: 1050,
    notes: 'Some notes',
    terms: 'Net 30',
  },
  changeSummary: 'Initial version',
  createdBy: USER_ID,
  createdAt: new Date('2024-01-01'),
  quotation: null,
  createdByUser: null,
  ...overrides,
} as QuotationVersion);

describe('VersioningService', () => {
  let service: VersioningService;
  let mockVersionRepo: Record<string, jest.Mock>;
  let mockQuotationRepo: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    mockVersionRepo = {
      create: jest.fn((data) => ({ id: VERSION_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockQuotationRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersioningService,
        { provide: getRepositoryToken(QuotationVersion), useValue: mockVersionRepo },
        { provide: getRepositoryToken(Quotation), useValue: mockQuotationRepo },
      ],
    }).compile();

    service = module.get<VersioningService>(VersioningService);
  });

  describe('createSnapshot', () => {
    it('should create a snapshot of the quotation with version number 1 when no prior versions exist', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(null); // no prior versions
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID);

      expect(result.versionNumber).toBe(1);
      expect(result.label).toBe('v1');
      expect(result.quotationId).toBe(QUOTATION_ID);
      expect(result.createdBy).toBe(USER_ID);
    });

    it('should increment the version number based on the last version', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(makeVersion({ versionNumber: 3 }));
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID);

      expect(result.versionNumber).toBe(4);
      expect(result.label).toBe('v4');
    });

    it('should use custom label when provided', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID, 'Release Candidate');

      expect(result.label).toBe('Release Candidate');
    });

    it('should store changeSummary when provided', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID, undefined, 'Updated pricing');

      expect(result.changeSummary).toBe('Updated pricing');
    });

    it('should include quotation items in the snapshot', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID);

      expect((result.snapshot as any).items).toHaveLength(1);
      expect((result.snapshot as any).items[0].name).toBe('Microscope');
      expect((result.snapshot as any).items[0].quantity).toBe(2);
      expect((result.snapshot as any).items[0].unitPrice).toBe(500);
    });

    it('should include quotation totals and metadata in the snapshot', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockVersionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID);

      const snap = result.snapshot as any;
      expect(snap.title).toBe('Lab Equipment Quotation');
      expect(snap.subtotal).toBe(1000);
      expect(snap.discount).toBe(5);
      expect(snap.tax).toBe(10);
      expect(snap.total).toBe(1050);
      expect(snap.notes).toBe('Some notes');
      expect(snap.terms).toBe('Net 30');
    });

    it('should throw NotFoundException when quotation is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createSnapshot(QUOTATION_ID, USER_ID, ORG_ID),
      ).rejects.toThrow('Quotation not found');
    });

    it('should throw NotFoundException when quotation belongs to a different organization', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSnapshot(QUOTATION_ID, USER_ID, 'other-org-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllVersions', () => {
    it('should return all versions for a quotation ordered by version number DESC', async () => {
      const quotation = makeQuotation();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      const versions = [
        makeVersion({ versionNumber: 3, id: 'v3' }),
        makeVersion({ versionNumber: 2, id: 'v2' }),
        makeVersion({ versionNumber: 1, id: 'v1' }),
      ];
      mockVersionRepo.find.mockResolvedValue(versions);

      const result = await service.findAllVersions(QUOTATION_ID, ORG_ID);

      expect(result).toHaveLength(3);
      expect(result[0].versionNumber).toBe(3);
    });

    it('should scope the quotation lookup by organizationId', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.find.mockResolvedValue([]);

      await service.findAllVersions(QUOTATION_ID, ORG_ID);

      expect(mockQuotationRepo.findOne).toHaveBeenCalledWith({
        where: { id: QUOTATION_ID, organizationId: ORG_ID },
      });
    });

    it('should throw NotFoundException when quotation is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);

      await expect(service.findAllVersions(QUOTATION_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findAllVersions(QUOTATION_ID, ORG_ID)).rejects.toThrow('Quotation not found');
    });

    it('should return empty array when no versions exist', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.find.mockResolvedValue([]);

      const result = await service.findAllVersions(QUOTATION_ID, ORG_ID);

      expect(result).toHaveLength(0);
    });
  });

  describe('findOneVersion', () => {
    it('should return a specific version when found', async () => {
      const quotation = makeQuotation();
      const version = makeVersion();
      mockQuotationRepo.findOne.mockResolvedValue(quotation);
      mockVersionRepo.findOne.mockResolvedValue(version);

      const result = await service.findOneVersion(QUOTATION_ID, VERSION_ID, ORG_ID);

      expect(result).toEqual(version);
      expect(mockVersionRepo.findOne).toHaveBeenCalledWith({
        where: { id: VERSION_ID, quotationId: QUOTATION_ID },
      });
    });

    it('should throw NotFoundException when quotation is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneVersion(QUOTATION_ID, VERSION_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOneVersion(QUOTATION_ID, VERSION_ID, ORG_ID)).rejects.toThrow('Quotation not found');
    });

    it('should throw NotFoundException when version is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneVersion(QUOTATION_ID, VERSION_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOneVersion(QUOTATION_ID, VERSION_ID, ORG_ID)).rejects.toThrow('Version not found');
    });

    it('should not return a version from a different quotation', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOneVersion(QUOTATION_ID, 'other-version-id', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('compareVersions', () => {
    const snapshotA = {
      title: 'Original Title',
      status: QuotationStatus.DRAFT,
      customerId: 'customer-uuid-1',
      items: [
        { name: 'Microscope', description: 'Basic', unit: 'piece', quantity: 2, unitPrice: 500, amount: 1000, sortOrder: 1 },
        { name: 'Centrifuge', description: 'Standard', unit: 'piece', quantity: 1, unitPrice: 800, amount: 800, sortOrder: 2 },
      ],
      subtotal: 1800,
      discount: 5,
      tax: 10,
      total: 1890,
      notes: 'Original notes',
      terms: 'Net 30',
    };

    const snapshotB = {
      title: 'Updated Title',
      status: QuotationStatus.DRAFT,
      customerId: 'customer-uuid-1',
      items: [
        { name: 'Microscope', description: 'Advanced', unit: 'piece', quantity: 3, unitPrice: 500, amount: 1500, sortOrder: 1 },
        { name: 'Pipette', description: 'New item', unit: 'box', quantity: 10, unitPrice: 50, amount: 500, sortOrder: 3 },
      ],
      subtotal: 2000,
      discount: 5,
      tax: 10,
      total: 2100,
      notes: 'Updated notes',
      terms: 'Net 30',
    };

    it('should detect added items in version B', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: snapshotB }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      const addedNames = result.diff.items.added.map((a: any) => a.item.name);
      expect(addedNames).toContain('Pipette');
    });

    it('should detect removed items from version A', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: snapshotB }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      const removedNames = result.diff.items.removed.map((r: any) => r.item.name);
      expect(removedNames).toContain('Centrifuge');
    });

    it('should detect modified items between versions', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: snapshotB }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      expect(result.diff.items.modified).toHaveLength(1);
      const modifiedItem = result.diff.items.modified[0];
      const changedFields = modifiedItem.changes.map((c: any) => c.field);
      expect(changedFields).toContain('description');
      expect(changedFields).toContain('quantity');
      expect(changedFields).toContain('amount');
    });

    it('should detect total changes between versions', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: snapshotB }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      expect(result.diff.totals.subtotal).toEqual({ from: 1800, to: 2000 });
      expect(result.diff.totals.total).toEqual({ from: 1890, to: 2100 });
    });

    it('should detect metadata changes between versions', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: snapshotB }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      expect(result.diff.metadata.title).toEqual({ from: 'Original Title', to: 'Updated Title' });
      expect(result.diff.metadata.notes).toEqual({ from: 'Original notes', to: 'Updated notes' });
    });

    it('should return version info for both versions', async () => {
      const vA = makeVersion({ versionNumber: 1, label: 'v1', snapshot: snapshotA, createdAt: new Date('2024-01-01') });
      const vB = makeVersion({ id: 'v2-id', versionNumber: 2, label: 'v2', snapshot: snapshotB, createdAt: new Date('2024-02-01') });
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(vA)
        .mockResolvedValueOnce(vB);

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      expect(result.versionA.number).toBe(1);
      expect(result.versionA.label).toBe('v1');
      expect(result.versionB.number).toBe(2);
      expect(result.versionB.label).toBe('v2');
    });

    it('should return empty diff when versions are identical', async () => {
      const identicalSnapshot = { ...snapshotA };
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: identicalSnapshot }))
        .mockResolvedValueOnce(makeVersion({ versionNumber: 2, snapshot: identicalSnapshot }));

      const result = await service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID);

      expect(result.diff.items.added).toHaveLength(0);
      expect(result.diff.items.removed).toHaveLength(0);
      expect(result.diff.items.modified).toHaveLength(0);
      expect(Object.keys(result.diff.totals)).toHaveLength(0);
      expect(Object.keys(result.diff.metadata)).toHaveLength(0);
    });

    it('should throw NotFoundException when quotation is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);

      await expect(service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.compareVersions(QUOTATION_ID, 1, 2, ORG_ID)).rejects.toThrow('Quotation not found');
    });

    it('should throw NotFoundException when one of the versions is not found', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(makeQuotation());
      // versionA found, versionB not found — always returns this sequence on each call
      mockVersionRepo.findOne
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(null)
        // second assertion call sequence
        .mockResolvedValueOnce(makeVersion({ versionNumber: 1, snapshot: snapshotA }))
        .mockResolvedValueOnce(null);

      await expect(service.compareVersions(QUOTATION_ID, 1, 99, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.compareVersions(QUOTATION_ID, 1, 99, ORG_ID)).rejects.toThrow(
        'One or both versions not found',
      );
    });
  });
});
