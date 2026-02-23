import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { N8nTriggerService } from './n8n-trigger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [N8nTriggerService],
  exports: [N8nTriggerService],
})
export class N8nTriggerModule {}
