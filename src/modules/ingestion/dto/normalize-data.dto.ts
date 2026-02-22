import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TranslatedItemDto {
  @ApiProperty({ example: 'May ly tam Model X200' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'May ly tam toc do cao cho phong xet nghiem' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'cai' })
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

export class TranslatedDataDto {
  @ApiPropertyOptional({ example: 'Bao gia nha cung cap #VQ-2026-001' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Cong ty TNHH ABC Medical Supplies' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiProperty({ type: [TranslatedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslatedItemDto)
  items: TranslatedItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;
}

export class NormalizeDataDto {
  @ApiProperty({ type: TranslatedDataDto })
  @ValidateNested()
  @Type(() => TranslatedDataDto)
  translatedData: TranslatedDataDto;

  @ApiPropertyOptional({ description: 'Customer ID to link quotation to' })
  @IsOptional()
  @IsString()
  customerId?: string;
}
