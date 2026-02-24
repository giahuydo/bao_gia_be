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
  @ApiProperty({ example: 'Centrifuge Model X200' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'High-speed centrifuge for laboratory use' })
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

export class TranslatedDataDto {
  @ApiPropertyOptional({ example: 'Vendor quotation #VQ-2026-001' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'ABC Medical Supplies Co., Ltd.' })
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
