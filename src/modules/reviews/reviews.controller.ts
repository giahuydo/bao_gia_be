import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto, ReviewQueryDto, ApproveReviewDto, RejectReviewDto, RequestRevisionDto } from './dto/create-review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a review request' })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: any) {
    return this.reviewsService.create(dto, user.id, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List review requests' })
  findAll(@Query() query: ReviewQueryDto, @CurrentUser() user: any) {
    return this.reviewsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reviewsService.findOne(id, user.organizationId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a review' })
  approve(@Param('id') id: string, @Body() dto: ApproveReviewDto, @CurrentUser() user: any) {
    return this.reviewsService.approve(id, user.id, user.organizationId, dto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a review' })
  reject(@Param('id') id: string, @Body() dto: RejectReviewDto, @CurrentUser() user: any) {
    return this.reviewsService.reject(id, user.id, user.organizationId, dto);
  }

  @Patch(':id/request-revision')
  @ApiOperation({ summary: 'Request revision on a review' })
  requestRevision(@Param('id') id: string, @Body() dto: RequestRevisionDto, @CurrentUser() user: any) {
    return this.reviewsService.requestRevision(id, user.id, user.organizationId, dto);
  }
}
