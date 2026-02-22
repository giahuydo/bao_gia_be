import { PartialType, OmitType } from '@nestjs/swagger';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQuotationDto } from './create-quotation.dto';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class UpdateQuotationDto extends PartialType(
  OmitType(CreateQuotationDto, ['items'] as const),
) {
  @ApiPropertyOptional({ type: [CreateQuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];
}
