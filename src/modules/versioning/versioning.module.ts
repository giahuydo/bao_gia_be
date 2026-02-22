import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersioningController } from './versioning.controller';
import { VersioningService } from './versioning.service';
import { QuotationVersion } from '../../database/entities/quotation-version.entity';
import { Quotation } from '../../database/entities/quotation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuotationVersion, Quotation])],
  controllers: [VersioningController],
  providers: [VersioningService],
  exports: [VersioningService],
})
export class VersioningModule {}
