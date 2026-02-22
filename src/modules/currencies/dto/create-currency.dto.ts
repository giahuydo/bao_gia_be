import { IsString, IsNumber, IsOptional, IsBoolean, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'VND' })
  @IsString()
  @MaxLength(3)
  code: string;

  @ApiProperty({ example: 'Vietnamese Dong' })
  @IsString()
  name: string;

  @ApiProperty({ example: '₫' })
  @IsString()
  @MaxLength(5)
  symbol: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @IsOptional()
  decimalPlaces?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
