import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecutionFailedDto {
  @ApiProperty({ description: 'n8n workflow name' })
  @IsString()
  workflowName: string;

  @ApiProperty({ description: 'n8n execution ID' })
  @IsString()
  executionId: string;

  @ApiProperty({ description: 'Error message' })
  @IsString()
  error: string;

  @ApiPropertyOptional({ description: 'Input data that caused the failure' })
  @IsOptional()
  @IsObject()
  inputData?: Record<string, any>;
}
