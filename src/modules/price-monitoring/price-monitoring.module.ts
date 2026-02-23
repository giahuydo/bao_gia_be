import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceMonitoringJob } from '../../database/entities/price-monitoring-job.entity';
import { PriceRecord } from '../../database/entities/price-record.entity';
import { PriceAlert } from '../../database/entities/price-alert.entity';
import { PriceMonitoringController } from './price-monitoring.controller';
import { PriceMonitoringService } from './price-monitoring.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceMonitoringJob, PriceRecord, PriceAlert])],
  controllers: [PriceMonitoringController],
  providers: [PriceMonitoringService],
  exports: [PriceMonitoringService],
})
export class PriceMonitoringModule {}
