import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsArray, IsOptional, IsString } from 'class-validator';
import { RuleCategory } from '../../../database/entities/rule-set.entity';

export class EvaluateRulesDto {
  @ApiProperty({ enum: RuleCategory })
  @IsEnum(RuleCategory)
  category: RuleCategory;

  @ApiProperty({ type: [Object], description: 'Array of items to evaluate against rules' })
  @IsArray()
  items: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Specific rule set ID to use (otherwise uses active for category)' })
  @IsOptional()
  @IsString()
  ruleSetId?: string;
}
