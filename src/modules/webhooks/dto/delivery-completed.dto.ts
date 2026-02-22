import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryCompletedDto {
  @ApiProperty({ description: 'n8n execution ID' })
  @IsString()
  executionId: string;

  @ApiProperty({ description: 'Quotation ID that was delivered' })
  @IsUUID()
  quotationId: string;

  @ApiPropertyOptional({ description: 'SMTP message ID' })
  @IsOptional()
  @IsString()
  emailMessageId?: string;

  @ApiProperty({ description: 'Timestamp when email was sent' })
  @IsDateString()
  sentAt: string;

  @ApiPropertyOptional({ description: 'Error message if delivery failed' })
  @IsOptional()
  @IsString()
  error?: string;
}
