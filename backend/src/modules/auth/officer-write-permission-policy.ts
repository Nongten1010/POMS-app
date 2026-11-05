import { env } from '../../config/env';
import type { AuthenticatedUser } from '../../shared/types/express';
import { isBinaryPermissionCode, type PermissionDataScope } from './permissions';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isOfficerWritePermission(permission: string, method: string): boolean {
  return writeMethods.has(method.toUpperCase()) && /:(edit|approve)$/.test(permission);
}

/** Never mutate the account context: read permissions and location qualifiers stay intact. */
export function getOfficerWritePermissionScope(
  user: AuthenticatedUser | undefined,
  permission: string,
  method: string,
): PermissionDataScope | undefined {
  if (
    !user ||
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED !== false ||
    (user.userType !== 'officer' && user.userType !== 'admin') ||
    !isOfficerWritePermission(permission, method)
  ) {
    return undefined;
  }
  return isBinaryPermissionCode(permission) ? null : 'ALL';
}
