import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { AiPromptVersion } from '../../database/entities/ai-prompt-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiPromptVersion])],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
