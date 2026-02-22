import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImproveDescriptionDto {
  @ApiProperty({ example: 'Thiet ke UI' })
  @IsString()
  itemName: string;

  @ApiProperty({ example: 'Thiet ke giao dien cho website' })
  @IsString()
  currentDescription: string;
}
