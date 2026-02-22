import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, IsObject, IsString } from 'class-validator';
import { ReviewType } from '../../../database/entities/review-request.entity';

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewType })
  @IsEnum(ReviewType)
  type: ReviewType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  quotationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty()
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  proposedData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

export class ReviewQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected', 'revision_requested'] })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: ['ingestion', 'status_change', 'price_override', 'comparison'] })
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}

export class ApproveReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reviewerChanges?: Record<string, any>;
}

export class RejectReviewDto {
  @ApiProperty()
  @IsString()
  reviewerNotes: string;
}

export class RequestRevisionDto {
  @ApiProperty()
  @IsString()
  reviewerNotes: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reviewerChanges?: Record<string, any>;
}
