import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecretGuard } from './webhook-secret.guard';

describe('WebhookSecretGuard', () => {
  let guard: WebhookSecretGuard;
  let configService: ConfigService;

  const mockRequest = (headers: Record<string, string> = {}) => ({
    headers,
    ip: '127.0.0.1',
    method: 'POST',
    url: '/api/webhooks/n8n/quotation-processed',
  });

  const mockContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  beforeEach(() => {
    configService = { get: jest.fn() } as any;
    guard = new WebhookSecretGuard(configService);
  });

  it('should pass with valid webhook secret', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-secret');
    const req = mockRequest({ 'x-webhook-secret': 'valid-secret' });
    expect(guard.canActivate(mockContext(req))).toBe(true);
  });

  it('should throw if webhook secret is not configured', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);
    const req = mockRequest({ 'x-webhook-secret': 'any' });
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw if webhook secret is missing from request', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-secret');
    const req = mockRequest({});
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw if webhook secret does not match', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-secret');
    const req = mockRequest({ 'x-webhook-secret': 'wrong' });
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });
});
