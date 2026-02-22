import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceAuthGuard } from './service-auth.guard';

describe('ServiceAuthGuard', () => {
  let guard: ServiceAuthGuard;
  let configService: ConfigService;

  const mockRequest = (headers: Record<string, string> = {}) => ({
    headers,
    ip: '127.0.0.1',
    method: 'POST',
    url: '/api/ingestion/extract',
  });

  const mockContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  beforeEach(() => {
    configService = { get: jest.fn() } as any;
    guard = new ServiceAuthGuard(configService);
  });

  it('should pass with valid service key', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-key');
    const req = mockRequest({ 'x-service-key': 'valid-key' });
    expect(guard.canActivate(mockContext(req))).toBe(true);
  });

  it('should attach n8n metadata to request', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-key');
    const req = mockRequest({
      'x-service-key': 'valid-key',
      'x-n8n-execution-id': 'exec-123',
    });
    guard.canActivate(mockContext(req));
    expect(req['n8nExecutionId']).toBe('exec-123');
    expect(req['serviceActor']).toBe('n8n-system');
  });

  it('should throw if service key is not configured', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);
    const req = mockRequest({ 'x-service-key': 'any-key' });
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw if service key is missing from request', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-key');
    const req = mockRequest({});
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw if service key does not match', () => {
    (configService.get as jest.Mock).mockReturnValue('valid-key');
    const req = mockRequest({ 'x-service-key': 'wrong-key' });
    expect(() => guard.canActivate(mockContext(req))).toThrow(
      UnauthorizedException,
    );
  });
});
