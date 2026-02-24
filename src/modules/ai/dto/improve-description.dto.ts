import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImproveDescriptionDto {
  @ApiProperty({ example: 'UI Design' })
  @IsString()
  itemName: string;

  @ApiProperty({ example: 'Website interface design' })
  @IsString()
  currentDescription: string;
}
