import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestItemsDto {
  @ApiProperty({ example: 'E-commerce website design quotation' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: ['UI/UX Design', 'Backend Development'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingItems?: string[];
}
