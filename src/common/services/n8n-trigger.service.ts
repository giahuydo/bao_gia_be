import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface N8nTriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

@Injectable()
export class N8nTriggerService {
  private readonly logger = new Logger(N8nTriggerService.name);
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('n8n.baseUrl') || 'http://localhost:5679';
  }

  async triggerWorkflow(webhookPath: string, payload: Record<string, any>): Promise<N8nTriggerResult> {
    const url = `${this.baseUrl}/webhook/${webhookPath}`;
    this.logger.log(`Triggering n8n workflow: POST ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`n8n trigger failed: ${response.status} ${errorText}`);
        return { success: false, error: `n8n returned ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, executionId: data.executionId || data.id };
    } catch (error) {
      this.logger.error(`n8n trigger error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async triggerWorkflowOrThrow(webhookPath: string, payload: Record<string, any>): Promise<{ executionId?: string }> {
    const result = await this.triggerWorkflow(webhookPath, payload);
    if (!result.success) {
      throw new Error(`Failed to trigger n8n workflow: ${result.error}`);
    }
    return { executionId: result.executionId };
  }
}
