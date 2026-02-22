import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { IngestionJob } from '../../database/entities/ingestion-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IngestionJob])],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
