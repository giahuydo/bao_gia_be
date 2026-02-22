import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleCategory } from '../../../database/entities/rule-set.entity';

export class RuleDefinitionDto {
  @ApiProperty({ example: 'unitPrice' })
  @IsString()
  field: string;

  @ApiProperty({ example: 'gt', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith'] })
  @IsString()
  operator: string;

  @ApiProperty({ example: 10000000 })
  value: any;

  @ApiProperty({ example: 'flag', enum: ['flag', 'reject', 'modify'] })
  @IsString()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  actionValue?: any;

  @ApiProperty({ example: 1 })
  priority: number;

  @ApiPropertyOptional({ example: 'Price exceeds 10M threshold' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CreateRuleSetDto {
  @ApiProperty({ enum: RuleCategory })
  @IsEnum(RuleCategory)
  category: RuleCategory;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [RuleDefinitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleDefinitionDto)
  rules: RuleDefinitionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
