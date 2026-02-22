import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guards webhook callback endpoints that n8n calls to report completion.
 * Validates the X-Webhook-Secret header.
 * Separate from ServiceAuthGuard so the two secrets can rotate independently.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSecretGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const webhookSecret = request.headers['x-webhook-secret'];
    const expectedSecret = this.configService.get<string>('n8n.webhookSecret');

    if (!expectedSecret) {
      this.logger.error('N8N_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException('Webhook authentication not configured');
    }

    if (!webhookSecret || webhookSecret !== expectedSecret) {
      this.logger.warn(
        `Invalid webhook secret from ${request.ip} on ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
