import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CompareVersionsQueryDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  versionA: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  versionB: number;
}
