import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Thiet ke website' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Thiet ke website responsive, SEO friendly' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'goi' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Min(0)
  defaultPrice: number;

  @ApiPropertyOptional({ example: 'Web Development' })
  @IsOptional()
  @IsString()
  category?: string;
}
