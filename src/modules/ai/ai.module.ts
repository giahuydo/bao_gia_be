import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TokenTrackingService } from './token-tracking.service';
import { TokenUsage } from '../../database/entities/token-usage.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TokenUsage])],
  controllers: [AiController],
  providers: [AiService, TokenTrackingService],
  exports: [AiService, TokenTrackingService],
})
export class AiModule {}
