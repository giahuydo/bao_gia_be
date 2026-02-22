import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtractDocumentDto {
  @ApiProperty({ description: 'ID of the uploaded attachment to extract data from' })
  @IsUUID()
  attachmentId: string;
}
