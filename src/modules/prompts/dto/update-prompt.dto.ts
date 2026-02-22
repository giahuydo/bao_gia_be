import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePromptDto } from './create-prompt.dto';

export class UpdatePromptDto extends PartialType(OmitType(CreatePromptDto, ['type'])) {}
