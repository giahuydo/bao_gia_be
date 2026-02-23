import { IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerMonitoringDto {
  @ApiPropertyOptional({ type: [String], description: 'Specific product IDs to monitor. If omitted, all org products are monitored.' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}
