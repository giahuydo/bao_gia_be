import { IsOptional, IsDateString, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AiOperation } from '../../../database/entities/token-usage.entity';

export class UsageSummaryQueryDto {
  @ApiPropertyOptional({ example: '2026-02-01', description: 'Start date (ISO)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-02-28', description: 'End date (ISO)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by tenant ID (future SaaS)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by quotation ID' })
  @IsOptional()
  @IsUUID()
  quotationId?: string;
}

export class UsageRecordsQueryDto extends UsageSummaryQueryDto {
  @ApiPropertyOptional({ enum: AiOperation, description: 'Filter by operation type' })
  @IsOptional()
  @IsEnum(AiOperation)
  operation?: AiOperation;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
