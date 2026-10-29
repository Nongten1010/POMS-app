import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { logger } from '../../config/logger';

export type AuthDiagnosticReason =
  | 'local_identity_not_found'
  | 'local_authenticated'
  | 'local_credentials_rejected'
  | 'local_inactive'
  | 'local_deleted'
  | 'local_password_missing'
  | 'local_failed'
  | 'diw_authenticated'
  | 'diw_rejected'
  | 'diw_invalid_response'
  | 'diw_http_error'
  | 'diw_timeout'
  | 'diw_request_failed';

const loginContext = new AsyncLocalStorage<{ requestId: string }>();

export function withAuthLoginDiagnostics<T>(work: (requestId: string) => Promise<T>): Promise<T> {
  const context = { requestId: randomUUID() };
  return loginContext.run(context, () => work(context.requestId));
}

export function recordAuthDecision(
  provider: 'local' | 'diw',
  reason: AuthDiagnosticReason,
  details: {
    userType?: 'operator' | 'officer' | 'citizen';
    status?: number;
    elapsedMs?: number;
  } = {},
): void {
  const level =
    reason === 'local_identity_not_found' || reason.endsWith('_authenticated') ? 'info' : 'warn';
  logger[level]('[auth] Login decision', {
    requestId: loginContext.getStore()?.requestId,
    provider,
    reason,
    userType: details.userType,
    status: details.status,
    elapsedMs: details.elapsedMs,
  });
}
