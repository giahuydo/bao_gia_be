import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateQuotationDto {
  @ApiProperty({
    example: 'Bao gia thiet ke website thuong mai dien tu cho cong ty ABC, bao gom thiet ke UI/UX, lap trinh frontend va backend, tich hop thanh toan',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  description: string;
}
