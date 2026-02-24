import { IsString, IsNumber, IsOptional, IsInt, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuotationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 'UI/UX Design' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'UI/UX design for 10 pages' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'package' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
