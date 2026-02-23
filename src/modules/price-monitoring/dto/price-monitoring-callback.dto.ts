import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceResultItem {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsString()
  productName: string;

  @ApiProperty()
  @IsNumber()
  previousPrice: number;

  @ApiProperty()
  @IsNumber()
  currentPrice: number;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty()
  @IsDateString()
  fetchedAt: string;
}

export class PriceMonitoringCallbackDto {
  @ApiProperty()
  @IsString()
  jobId: string;

  @ApiProperty()
  @IsString()
  executionId: string;

  @ApiProperty({ enum: ['completed', 'failed', 'partial'] })
  @IsEnum(['completed', 'failed', 'partial'])
  status: 'completed' | 'failed' | 'partial';

  @ApiPropertyOptional({ type: [PriceResultItem] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceResultItem)
  results?: PriceResultItem[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  processingTimeMs?: number;
}
