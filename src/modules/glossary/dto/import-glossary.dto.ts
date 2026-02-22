import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateGlossaryTermDto } from './create-glossary-term.dto';

export class ImportGlossaryDto {
  @ApiProperty({ type: [CreateGlossaryTermDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGlossaryTermDto)
  terms: CreateGlossaryTermDto[];

  @ApiPropertyOptional({ description: 'If true, update existing terms instead of skipping' })
  @IsOptional()
  upsert?: boolean;
}

export class GlossaryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
