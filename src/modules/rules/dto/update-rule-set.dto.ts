import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRuleSetDto } from './create-rule-set.dto';

export class UpdateRuleSetDto extends PartialType(OmitType(CreateRuleSetDto, ['category'])) {}
