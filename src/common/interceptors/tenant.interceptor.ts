import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../services/tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    // Set userId from JWT
    this.tenantContext.userId = user.id;

    // Resolve organizationId: header override > JWT default
    const headerOrgId = request.headers['x-organization-id'];
    const jwtOrgId = user.organizationId;

    if (headerOrgId) {
      // Validate user has access to the requested org
      if (user.organizationIds && !user.organizationIds.includes(headerOrgId)) {
        throw new ForbiddenException('No access to the specified organization');
      }
      this.tenantContext.organizationId = headerOrgId;
    } else if (jwtOrgId) {
      this.tenantContext.organizationId = jwtOrgId;
    }

    return next.handle();
  }
}
