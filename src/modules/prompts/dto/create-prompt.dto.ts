import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, IsOptional, Min } from 'class-validator';
import { PromptType } from '../../../database/entities/ai-prompt-version.entity';

export class CreatePromptDto {
  @ApiProperty({ enum: PromptType })
  @IsEnum(PromptType)
  type: PromptType;

  @ApiProperty()
  @IsString()
  systemPrompt: string;

  @ApiProperty()
  @IsString()
  userPromptTemplate: string;

  @ApiProperty({ example: 'claude-sonnet-4-20250514' })
  @IsString()
  model: string;

  @ApiProperty({ example: 8192 })
  @IsInt()
  @Min(100)
  maxTokens: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeNotes?: string;
}
