import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { Attachment } from '../../database/entities/attachment.entity';

// ---------------------------------------------------------------------------
// fs mock -- must be hoisted before any imports that use it
// ---------------------------------------------------------------------------
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn(),
}));

// uuid mock so we get a deterministic file name
jest.mock('uuid', () => ({ v4: jest.fn(() => 'fixed-uuid') }));

import * as fs from 'fs';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const QUOTATION_ID = 'quotation-uuid-1';
const ATTACHMENT_ID = 'attachment-uuid-1';

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'invoice.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('dummy content'),
    size: 1024,
    ...overrides,
  } as Express.Multer.File);

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment =>
  ({
    id: ATTACHMENT_ID,
    organizationId: ORG_ID,
    quotationId: QUOTATION_ID,
    fileName: 'fixed-uuid.pdf',
    originalName: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    filePath: `/some/upload/dir/${ORG_ID}/fixed-uuid.pdf`,
    uploadedBy: USER_ID,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as Attachment);

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Make existsSync return true by default so the constructor does not try
    // to create directories on the real filesystem.
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    mockRepo = {
      create: jest.fn((data) => ({ id: ATTACHMENT_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  // ---------------------------------------------------------------------------
  // upload()
  // ---------------------------------------------------------------------------
  describe('upload', () => {
    it('should write the file buffer to disk and save an attachment record', async () => {
      const file = makeFile();
      mockRepo.save.mockResolvedValue(makeAttachment());

      const result = await service.upload(file, QUOTATION_ID, USER_ID, ORG_ID);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quotationId: QUOTATION_ID,
          originalName: 'invoice.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          uploadedBy: USER_ID,
          organizationId: ORG_ID,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should derive the file name from a uuid + original extension', async () => {
      const file = makeFile({ originalname: 'report.xlsx' });
      mockRepo.save.mockResolvedValue(makeAttachment({ fileName: 'fixed-uuid.xlsx' }));

      await service.upload(file, QUOTATION_ID, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'fixed-uuid.xlsx' }),
      );
    });

    it('should create the organization upload directory when it does not exist', async () => {
      // The module is already compiled (constructor ran) in beforeEach.
      // Now override existsSync so that the next call (inside getUploadDir
      // during upload) returns false, triggering mkdirSync.
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const file = makeFile();
      mockRepo.save.mockResolvedValue(makeAttachment());

      await service.upload(file, QUOTATION_ID, USER_ID, ORG_ID);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(ORG_ID), {
        recursive: true,
      });
    });

    it('should return the saved attachment entity', async () => {
      const savedAttachment = makeAttachment();
      const file = makeFile();
      mockRepo.save.mockResolvedValue(savedAttachment);

      const result = await service.upload(file, QUOTATION_ID, USER_ID, ORG_ID);

      expect(result).toEqual(savedAttachment);
    });

    it('should store the full file path in the attachment record', async () => {
      const file = makeFile({ originalname: 'doc.pdf' });
      mockRepo.save.mockResolvedValue(makeAttachment());

      await service.upload(file, QUOTATION_ID, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: expect.stringContaining('fixed-uuid.pdf'),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findByQuotation()
  // ---------------------------------------------------------------------------
  describe('findByQuotation', () => {
    it('should find attachments scoped by quotationId and organizationId', async () => {
      mockRepo.find.mockResolvedValue([makeAttachment()]);

      await service.findByQuotation(QUOTATION_ID, ORG_ID);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { quotationId: QUOTATION_ID, organizationId: ORG_ID },
        order: { createdAt: 'DESC' },
      });
    });

    it('should query by quotationId only when organizationId is not provided', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findByQuotation(QUOTATION_ID);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { quotationId: QUOTATION_ID },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return all attachments for the quotation ordered by createdAt DESC', async () => {
      const attachments = [
        makeAttachment({ id: 'att-1', createdAt: new Date('2024-01-02') }),
        makeAttachment({ id: 'att-2', createdAt: new Date('2024-01-01') }),
      ];
      mockRepo.find.mockResolvedValue(attachments);

      const result = await service.findByQuotation(QUOTATION_ID, ORG_ID);

      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no attachments exist for the quotation', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByQuotation(QUOTATION_ID, ORG_ID);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return an attachment when found by id and organizationId', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);

      const result = await service.findOne(ATTACHMENT_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: ATTACHMENT_ID, organizationId: ORG_ID },
      });
      expect(result).toEqual(attachment);
    });

    it('should query without organizationId when it is not provided', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);

      await service.findOne(ATTACHMENT_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: ATTACHMENT_ID },
      });
    });

    it('should throw NotFoundException when attachment is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ATTACHMENT_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(ATTACHMENT_ID, ORG_ID)).rejects.toThrow('Attachment not found');
    });

    it('should throw NotFoundException when querying a different organization attachment', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ATTACHMENT_ID, 'other-org-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete the file from disk and remove the DB record', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.remove(ATTACHMENT_ID, ORG_ID);

      expect(fs.unlinkSync).toHaveBeenCalledWith(attachment.filePath);
      expect(mockRepo.remove).toHaveBeenCalledWith(attachment);
    });

    it('should skip unlinkSync when the file does not exist on disk', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.remove(ATTACHMENT_ID, ORG_ID);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(mockRepo.remove).toHaveBeenCalledWith(attachment);
    });

    it('should throw NotFoundException when removing a non-existent attachment', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('should return void on successful removal', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.remove(ATTACHMENT_ID, ORG_ID);

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getFilePath()
  // ---------------------------------------------------------------------------
  describe('getFilePath', () => {
    it('should return path, originalName and mimeType for the attachment', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);

      const result = await service.getFilePath(ATTACHMENT_ID, ORG_ID);

      expect(result).toEqual({
        path: attachment.filePath,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
      });
    });

    it('should throw NotFoundException when the attachment does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getFilePath('non-existent-id', ORG_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should work without organizationId', async () => {
      const attachment = makeAttachment();
      mockRepo.findOne.mockResolvedValue(attachment);

      const result = await service.getFilePath(ATTACHMENT_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: ATTACHMENT_ID } });
      expect(result.path).toBe(attachment.filePath);
    });

    it('should return the correct mimeType for image attachments', async () => {
      const imageAttachment = makeAttachment({
        originalName: 'screenshot.png',
        mimeType: 'image/png',
        fileName: 'fixed-uuid.png',
        filePath: `/uploads/${ORG_ID}/fixed-uuid.png`,
      });
      mockRepo.findOne.mockResolvedValue(imageAttachment);

      const result = await service.getFilePath(ATTACHMENT_ID, ORG_ID);

      expect(result.mimeType).toBe('image/png');
      expect(result.originalName).toBe('screenshot.png');
    });
  });
});
