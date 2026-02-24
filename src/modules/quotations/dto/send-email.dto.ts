import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ example: 'customer@example.com', description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({ example: 'manager@example.com', description: 'CC email address' })
  @IsOptional()
  @IsEmail()
  cc?: string;

  @ApiPropertyOptional({ example: 'Quotation BG-20260224-001 from ABC Company' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Custom HTML email body. If omitted, a default template is used.' })
  @IsOptional()
  @IsString()
  body?: string;
}
