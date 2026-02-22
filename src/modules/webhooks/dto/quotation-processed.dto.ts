import { IsString, IsEnum, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProcessingStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export class QuotationProcessedDto {
  @ApiProperty({ description: 'n8n execution ID' })
  @IsString()
  executionId: string;

  @ApiPropertyOptional({ description: 'Quotation ID created by the pipeline' })
  @IsOptional()
  @IsUUID()
  quotationId?: string;

  @ApiProperty({ enum: ProcessingStatus })
  @IsEnum(ProcessingStatus)
  status: ProcessingStatus;

  @ApiPropertyOptional({ description: 'Processing time in milliseconds' })
  @IsOptional()
  @IsNumber()
  processingTimeMs?: number;

  @ApiPropertyOptional({ description: 'Error message if status is failed' })
  @IsOptional()
  @IsString()
  error?: string;
}
