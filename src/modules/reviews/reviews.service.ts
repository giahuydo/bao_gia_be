import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewRequest, ReviewStatus } from '../../database/entities/review-request.entity';
import { CreateReviewDto, ApproveReviewDto, RejectReviewDto, RequestRevisionDto } from './dto/create-review.dto';
import { ReviewRequestCreatedEvent } from '../telegram/events/telegram.events';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewRequest)
    private reviewRepository: Repository<ReviewRequest>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateReviewDto, userId: string, orgId: string) {
    const review = this.reviewRepository.create({
      ...dto,
      organizationId: orgId,
      requestedBy: userId,
      status: ReviewStatus.PENDING,
    });
    const saved = await this.reviewRepository.save(review);

    // Load relations for event
    const full = await this.reviewRepository.findOne({
      where: { id: saved.id },
      relations: ['requestedByUser', 'assignedToUser', 'quotation'],
    });

    this.eventEmitter.emit(
      'review.created',
      new ReviewRequestCreatedEvent(
        saved.id,
        saved.type,
        full?.requestedByUser?.fullName || userId,
        (full?.quotation as any)?.id,
        (full?.quotation as any)?.quotationNumber,
        full?.assignedToUser?.fullName,
      ),
    );

    return saved;
  }

  async findAll(orgId: string, filters: { status?: string; type?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { organizationId: orgId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    const [data, total] = await this.reviewRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['requestedByUser', 'assignedToUser'],
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, orgId: string) {
    const review = await this.reviewRepository.findOne({
      where: { id, organizationId: orgId },
      relations: ['requestedByUser', 'assignedToUser', 'reviewedByUser'],
    });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async approve(id: string, userId: string, orgId: string, dto?: ApproveReviewDto) {
    const review = await this.findOne(id, orgId);
    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Only pending reviews can be approved');
    }
    review.status = ReviewStatus.APPROVED;
    review.reviewedBy = userId;
    review.reviewedAt = new Date();
    if (dto?.reviewerNotes) review.reviewerNotes = dto.reviewerNotes;
    if (dto?.reviewerChanges) review.reviewerChanges = dto.reviewerChanges;
    return this.reviewRepository.save(review);
  }

  async reject(id: string, userId: string, orgId: string, dto: RejectReviewDto) {
    const review = await this.findOne(id, orgId);
    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Only pending reviews can be rejected');
    }
    review.status = ReviewStatus.REJECTED;
    review.reviewedBy = userId;
    review.reviewedAt = new Date();
    review.reviewerNotes = dto.reviewerNotes;
    return this.reviewRepository.save(review);
  }

  async requestRevision(id: string, userId: string, orgId: string, dto: RequestRevisionDto) {
    const review = await this.findOne(id, orgId);
    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Only pending reviews can be sent back for revision');
    }
    review.status = ReviewStatus.REVISION_REQUESTED;
    review.reviewedBy = userId;
    review.reviewedAt = new Date();
    review.reviewerNotes = dto.reviewerNotes;
    if (dto.reviewerChanges) review.reviewerChanges = dto.reviewerChanges;
    return this.reviewRepository.save(review);
  }
}
