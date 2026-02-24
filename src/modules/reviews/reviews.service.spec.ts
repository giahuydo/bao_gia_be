import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewsService } from './reviews.service';
import { ReviewRequest, ReviewStatus, ReviewType } from '../../database/entities/review-request.entity';
import { CreateReviewDto, ApproveReviewDto, RejectReviewDto, RequestRevisionDto } from './dto/create-review.dto';

const ORG_ID = 'org-uuid-1';
const USER_ID = 'user-uuid-1';
const REVIEW_ID = 'review-uuid-1';

const makeReview = (overrides: Partial<ReviewRequest> = {}): ReviewRequest => ({
  id: REVIEW_ID,
  organizationId: ORG_ID,
  type: ReviewType.INGESTION,
  status: ReviewStatus.PENDING,
  quotationId: 'quotation-uuid-1',
  jobId: null,
  payload: { key: 'value' },
  proposedData: null,
  reviewerNotes: null,
  reviewerChanges: null,
  requestedBy: USER_ID,
  requestedByUser: null,
  assignedTo: null,
  assignedToUser: null,
  reviewedBy: null,
  reviewedByUser: null,
  reviewedAt: null,
  quotation: null,
  organization: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
} as ReviewRequest);

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockRepo: Record<string, jest.Mock>;
  let mockEventEmitter: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ id: REVIEW_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(ReviewRequest), useValue: mockRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('create', () => {
    it('should create a review with pending status, orgId, and userId', async () => {
      const dto: CreateReviewDto = {
        type: ReviewType.INGESTION,
        payload: { file: 'doc.pdf' },
      };

      const savedReview = makeReview();
      mockRepo.save.mockResolvedValue(savedReview);
      // findOne for loading relations
      mockRepo.findOne
        .mockResolvedValueOnce({
          ...savedReview,
          requestedByUser: { fullName: 'Test User' },
          assignedToUser: null,
          quotation: { id: 'quotation-uuid-1', quotationNumber: 'BG-001' },
        });

      const result = await service.create(dto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        organizationId: ORG_ID,
        requestedBy: USER_ID,
        status: ReviewStatus.PENDING,
      });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(ReviewStatus.PENDING);
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.requestedBy).toBe(USER_ID);
    });

    it('should emit review.created event after creation', async () => {
      const dto: CreateReviewDto = {
        type: ReviewType.STATUS_CHANGE,
        payload: { oldStatus: 'draft', newStatus: 'sent' },
      };

      const savedReview = makeReview({ type: ReviewType.STATUS_CHANGE });
      mockRepo.save.mockResolvedValue(savedReview);
      mockRepo.findOne.mockResolvedValueOnce({
        ...savedReview,
        requestedByUser: { fullName: 'Manager A' },
        assignedToUser: { fullName: 'Admin B' },
        quotation: { id: 'quotation-uuid-1', quotationNumber: 'BG-001' },
      });

      await service.create(dto, USER_ID, ORG_ID);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'review.created',
        expect.objectContaining({
          reviewId: REVIEW_ID,
          type: ReviewType.STATUS_CHANGE,
        }),
      );
    });

    it('should emit review.created event with userId as fallback when requestedByUser is null', async () => {
      const dto: CreateReviewDto = {
        type: ReviewType.INGESTION,
        payload: {},
      };

      const savedReview = makeReview();
      mockRepo.save.mockResolvedValue(savedReview);
      mockRepo.findOne.mockResolvedValueOnce({
        ...savedReview,
        requestedByUser: null,
        assignedToUser: null,
        quotation: null,
      });

      await service.create(dto, USER_ID, ORG_ID);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'review.created',
        expect.objectContaining({ requestedByName: USER_ID }),
      );
    });

    it('should assign the review when assignedTo is provided in dto', async () => {
      const ASSIGNEE_ID = 'assignee-uuid-1';
      const dto: CreateReviewDto = {
        type: ReviewType.PRICE_OVERRIDE,
        payload: { price: 1000 },
        assignedTo: ASSIGNEE_ID,
      };

      mockRepo.save.mockResolvedValue(makeReview({ assignedTo: ASSIGNEE_ID }));
      mockRepo.findOne.mockResolvedValueOnce(makeReview({ assignedTo: ASSIGNEE_ID }));

      const result = await service.create(dto, USER_ID, ORG_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: ASSIGNEE_ID }),
      );
      expect(result.assignedTo).toBe(ASSIGNEE_ID);
    });
  });

  describe('findAll', () => {
    it('should scope query by organizationId', async () => {
      await service.findAll(ORG_ID, {});

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('should apply status filter when provided', async () => {
      await service.findAll(ORG_ID, { status: 'pending' });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should apply type filter when provided', async () => {
      await service.findAll(ORG_ID, { type: 'ingestion' });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'ingestion' }),
        }),
      );
    });

    it('should not apply status filter when not provided', async () => {
      await service.findAll(ORG_ID, {});

      const callArg = mockRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
    });

    it('should return paginated results with default page and limit', async () => {
      const reviews = [makeReview(), makeReview({ id: 'review-uuid-2' })];
      mockRepo.findAndCount.mockResolvedValue([reviews, 2]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply correct skip when page is specified', async () => {
      await service.findAll(ORG_ID, { page: 3, limit: 10 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should load requestedByUser and assignedToUser relations', async () => {
      await service.findAll(ORG_ID, {});

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['requestedByUser', 'assignedToUser']),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a review when found by id and organizationId', async () => {
      const review = makeReview();
      mockRepo.findOne.mockResolvedValue(review);

      const result = await service.findOne(REVIEW_ID, ORG_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: REVIEW_ID, organizationId: ORG_ID },
        relations: ['requestedByUser', 'assignedToUser', 'reviewedByUser'],
      });
      expect(result).toEqual(review);
    });

    it('should throw NotFoundException when review is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(REVIEW_ID, ORG_ID)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(REVIEW_ID, ORG_ID)).rejects.toThrow('Review not found');
    });

    it('should throw NotFoundException when querying a different organization review', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(REVIEW_ID, 'other-org-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should approve a pending review and set reviewedBy and reviewedAt', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.approve(REVIEW_ID, USER_ID, ORG_ID);

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(result.reviewedBy).toBe(USER_ID);
      expect(result.reviewedAt).toBeInstanceOf(Date);
    });

    it('should set reviewerNotes when provided in dto', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: ApproveReviewDto = { reviewerNotes: 'Looks good', reviewerChanges: { price: 200 } };
      const result = await service.approve(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(result.reviewerNotes).toBe('Looks good');
      expect(result.reviewerChanges).toEqual({ price: 200 });
    });

    it('should throw BadRequestException when approving a non-pending review', async () => {
      const approvedReview = makeReview({ status: ReviewStatus.APPROVED });
      mockRepo.findOne.mockResolvedValue(approvedReview);

      await expect(service.approve(REVIEW_ID, USER_ID, ORG_ID)).rejects.toThrow(BadRequestException);
      await expect(service.approve(REVIEW_ID, USER_ID, ORG_ID)).rejects.toThrow(
        'Only pending reviews can be approved',
      );
    });

    it('should throw BadRequestException when approving a rejected review', async () => {
      const rejectedReview = makeReview({ status: ReviewStatus.REJECTED });
      mockRepo.findOne.mockResolvedValue(rejectedReview);

      await expect(service.approve(REVIEW_ID, USER_ID, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('should save the updated review', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);

      await service.approve(REVIEW_ID, USER_ID, ORG_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.APPROVED }),
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending review and set reviewer details', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: RejectReviewDto = { reviewerNotes: 'Price too high' };
      const result = await service.reject(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(result.status).toBe(ReviewStatus.REJECTED);
      expect(result.reviewedBy).toBe(USER_ID);
      expect(result.reviewedAt).toBeInstanceOf(Date);
      expect(result.reviewerNotes).toBe('Price too high');
    });

    it('should throw BadRequestException when rejecting a non-pending review', async () => {
      const approvedReview = makeReview({ status: ReviewStatus.APPROVED });
      mockRepo.findOne.mockResolvedValue(approvedReview);

      const dto: RejectReviewDto = { reviewerNotes: 'Rejection reason' };
      await expect(service.reject(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.reject(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(
        'Only pending reviews can be rejected',
      );
    });

    it('should throw BadRequestException when rejecting a revision_requested review', async () => {
      const revisionReview = makeReview({ status: ReviewStatus.REVISION_REQUESTED });
      mockRepo.findOne.mockResolvedValue(revisionReview);

      const dto: RejectReviewDto = { reviewerNotes: 'Still not good' };
      await expect(service.reject(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should save the rejected review', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);

      const dto: RejectReviewDto = { reviewerNotes: 'Rejected' };
      await service.reject(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.REJECTED }),
      );
    });
  });

  describe('requestRevision', () => {
    it('should set status to revision_requested and set reviewer details', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: RequestRevisionDto = { reviewerNotes: 'Please fix the quantities' };
      const result = await service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(result.status).toBe(ReviewStatus.REVISION_REQUESTED);
      expect(result.reviewedBy).toBe(USER_ID);
      expect(result.reviewedAt).toBeInstanceOf(Date);
      expect(result.reviewerNotes).toBe('Please fix the quantities');
    });

    it('should set reviewerChanges when provided', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const dto: RequestRevisionDto = {
        reviewerNotes: 'Update items',
        reviewerChanges: { items: [{ name: 'Product A', quantity: 5 }] },
      };
      const result = await service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(result.reviewerChanges).toEqual({ items: [{ name: 'Product A', quantity: 5 }] });
    });

    it('should throw BadRequestException when requesting revision on a non-pending review', async () => {
      const approvedReview = makeReview({ status: ReviewStatus.APPROVED });
      mockRepo.findOne.mockResolvedValue(approvedReview);

      const dto: RequestRevisionDto = { reviewerNotes: 'Revise this' };
      await expect(service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(
        'Only pending reviews can be sent back for revision',
      );
    });

    it('should throw BadRequestException when requesting revision on a rejected review', async () => {
      const rejectedReview = makeReview({ status: ReviewStatus.REJECTED });
      mockRepo.findOne.mockResolvedValue(rejectedReview);

      const dto: RequestRevisionDto = { reviewerNotes: 'Revise' };
      await expect(service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should save the review with revision_requested status', async () => {
      const pendingReview = makeReview({ status: ReviewStatus.PENDING });
      mockRepo.findOne.mockResolvedValue(pendingReview);

      const dto: RequestRevisionDto = { reviewerNotes: 'Revision notes' };
      await service.requestRevision(REVIEW_ID, USER_ID, ORG_ID, dto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.REVISION_REQUESTED }),
      );
    });
  });
});
