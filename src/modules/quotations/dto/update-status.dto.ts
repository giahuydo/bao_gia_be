import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { QuotationStatus } from '../../../database/entities/quotation.entity';

export class UpdateStatusDto {
  @ApiProperty({ enum: QuotationStatus })
  @IsEnum(QuotationStatus)
  status: QuotationStatus;
}
