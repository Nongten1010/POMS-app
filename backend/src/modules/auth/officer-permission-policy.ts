import { env } from '../../config/env';
import { RBAC_MATRIX_V20260810_PERMISSIONS } from '../../db/seeds/rbac_matrix_v20260810';
import type { AuthenticatedUser } from '../../shared/types/express';
import { isBinaryPermissionCode, type PermissionScopeDetails } from './permissions';

/** Request-only policy: never persist these grants or use them in login/me responses. */
export function applyOfficerPermissionPolicy(user: AuthenticatedUser): AuthenticatedUser {
  if (
    env.OFFICER_PERMISSION_CHECKS_ENABLED !== false ||
    (user.userType !== 'officer' && user.userType !== 'admin')
  ) {
    return user;
  }

  const codes = new Set([
    ...RBAC_MATRIX_V20260810_PERMISSIONS.map(({ code }) => code),
    ...Object.keys(user.scopes),
  ]);
  const scopeDetails: Record<string, PermissionScopeDetails> = Object.fromEntries(
    [...codes].map((code) => [code, { scope: isBinaryPermissionCode(code) ? null : 'ALL' }]),
  );

  return {
    ...user,
    scopes: Object.fromEntries(
      Object.entries(scopeDetails).map(([code, { scope }]) => [code, scope]),
    ),
    scopeDetails,
    regionalAccess: null,
  };
}
