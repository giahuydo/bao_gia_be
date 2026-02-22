import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { OrganizationPlan } from '../../../database/entities/organization.entity';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'A laboratory equipment company' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ enum: OrganizationPlan, default: OrganizationPlan.FREE })
  @IsOptional()
  @IsEnum(OrganizationPlan)
  plan?: OrganizationPlan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;
}
