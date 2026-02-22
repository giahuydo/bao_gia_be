import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlossaryController } from './glossary.controller';
import { GlossaryService } from './glossary.service';
import { GlossaryTerm } from '../../database/entities/glossary-term.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GlossaryTerm])],
  controllers: [GlossaryController],
  providers: [GlossaryService],
  exports: [GlossaryService],
})
export class GlossaryModule {}
