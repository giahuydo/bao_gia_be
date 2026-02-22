import { IsString, IsNumber, IsOptional, IsInt, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuotationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 'Thiet ke giao dien' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Thiet ke UI/UX cho 10 trang' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'goi' })
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
