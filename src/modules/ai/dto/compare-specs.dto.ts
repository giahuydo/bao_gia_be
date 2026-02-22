import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNumber, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SpecItem {
  @ApiProperty({ example: 'Centrifuge 5424' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Microcentrifuge with 24-place rotor' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'unit' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ example: 150000000 })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'lab' })
  @IsOptional()
  @IsString()
  category?: string;
}

class VendorSpec {
  @ApiProperty({ type: [SpecItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecItem)
  items: SpecItem[];
}

class CustomerRequirement {
  @ApiProperty({ type: [SpecItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecItem)
  items: SpecItem[];

  @ApiPropertyOptional({ example: 500000000 })
  @IsOptional()
  @IsNumber()
  budget?: number;
}

export class CompareSpecsDto {
  @ApiProperty({ type: VendorSpec })
  @ValidateNested()
  @Type(() => VendorSpec)
  vendorSpec: VendorSpec;

  @ApiProperty({ type: CustomerRequirement })
  @ValidateNested()
  @Type(() => CustomerRequirement)
  customerRequirement: CustomerRequirement;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  quotationId?: string;
}
