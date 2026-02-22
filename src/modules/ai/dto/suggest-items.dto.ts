import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestItemsDto {
  @ApiProperty({ example: 'Bao gia thiet ke website ecommerce' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: ['Thiet ke UI/UX', 'Lap trinh backend'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingItems?: string[];
}
