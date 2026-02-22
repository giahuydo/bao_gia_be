import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guards endpoints that are called by n8n (service-to-service).
 * Validates the X-Service-Key header against the configured secret.
 * This is separate from JwtAuthGuard — no user session, no JWT.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAuthGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceKey = request.headers['x-service-key'];
    const expectedKey = this.configService.get<string>('n8n.serviceKey');

    if (!expectedKey) {
      this.logger.error('N8N_SERVICE_KEY is not configured');
      throw new UnauthorizedException('Service authentication not configured');
    }

    if (!serviceKey || serviceKey !== expectedKey) {
      this.logger.warn(
        `Invalid service key from ${request.ip} on ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid service key');
    }

    // Attach n8n execution metadata to request for downstream logging
    request.n8nExecutionId = request.headers['x-n8n-execution-id'] || null;
    request.serviceActor = 'n8n-system';

    return true;
  }
}
