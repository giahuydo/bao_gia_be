import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateGlossaryTermDto {
  @ApiProperty({ example: 'Centrifuge' })
  @IsString()
  sourceTerm: string;

  @ApiProperty({ example: 'May ly tam' })
  @IsString()
  targetTerm: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  sourceLanguage?: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsOptional()
  @IsString()
  targetLanguage?: string;

  @ApiPropertyOptional({ example: 'lab' })
  @IsOptional()
  @IsString()
  category?: string;
}
