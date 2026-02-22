import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateGlossaryTermDto } from './create-glossary-term.dto';

export class UpdateGlossaryTermDto extends PartialType(OmitType(CreateGlossaryTermDto, ['sourceTerm'])) {}
