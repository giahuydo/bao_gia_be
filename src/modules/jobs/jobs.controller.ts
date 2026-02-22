import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { JobQueryDto } from './dto/job-query.dto';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs/ingestion')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an async ingestion job' })
  create(@Body() dto: CreateJobDto, @CurrentUser() user: any) {
    return this.jobsService.create(dto, user.id, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List ingestion jobs' })
  findAll(@Query() query: JobQueryDto, @CurrentUser() user: any) {
    return this.jobsService.findAll(user.organizationId, query);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get job status and results' })
  findOne(@Param('jobId') id: string, @CurrentUser() user: any) {
    return this.jobsService.findOne(id, user.organizationId);
  }

  @Post(':jobId/retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  retry(@Param('jobId') id: string, @CurrentUser() user: any) {
    return this.jobsService.retry(id, user.organizationId);
  }
}
