import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateQuotationDto {
  @ApiProperty({
    example: 'Quotation for e-commerce website design for ABC Company, including UI/UX design, frontend and backend development, payment integration',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  description: string;
}
