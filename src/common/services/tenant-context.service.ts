import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private _organizationId: string;
  private _userId: string;

  get organizationId(): string {
    return this._organizationId;
  }

  set organizationId(value: string) {
    this._organizationId = value;
  }

  get userId(): string {
    return this._userId;
  }

  set userId(value: string) {
    this._userId = value;
  }
}
