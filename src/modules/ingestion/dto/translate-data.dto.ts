import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ExtractedItemDto {
  @ApiProperty({ example: 'Centrifuge Model X200' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'High-speed centrifuge for clinical labs' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'unit' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class ExtractedDataDto {
  @ApiPropertyOptional({ example: 'Vendor Quotation #VQ-2026-001' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'ABC Medical Supplies Co.' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiProperty({ type: [ExtractedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedItemDto)
  items: ExtractedItemDto[];

  @ApiPropertyOptional({ example: 'FOB Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Net 30 days' })
  @IsOptional()
  @IsString()
  terms?: string;
}

export class TranslateDataDto {
  @ApiProperty({ type: ExtractedDataDto })
  @ValidateNested()
  @Type(() => ExtractedDataDto)
  extractedData: ExtractedDataDto;
}
