import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import type { PermissionScopeDetails } from '../../modules/auth/permissions';

/**
 * Middleware เช็คว่า user มี permission อย่างน้อย 1 ใน list หรือไม่
 * Usage: `app.get('/foo', authenticate, authorize('factories:view'), handler)`
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError('Authentication required'));
    const userPerms = Object.keys(req.user.scopes);
    const hasAny = requiredPermissions.some((p) => userPerms.includes(p));
    if (!hasAny) {
      return next(
        new ForbiddenError(`Missing required permission: ${requiredPermissions.join(' or ')}`),
      );
    }
    return next();
  };
}

/**
 * Helper: ดู scope ของ permission ที่ user มี — ใช้ใน service layer
 * Returns: 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null
 *          null = มี permission แต่ไม่มี scope dimension (binary action)
 *          undefined = ไม่มี permission เลย
 */
export function getScope(req: Request, permission: string): string | null | undefined {
  if (!req.user) return undefined;
  if (!(permission in req.user.scopes)) return undefined;
  return req.user.scopes[permission];
}

export function getScopeDetails(
  req: Request,
  permission: string,
): PermissionScopeDetails | undefined {
  const detailedScope = req.user?.scopeDetails?.[permission];
  if (detailedScope) return detailedScope;
  const scope = getScope(req, permission);
  return scope === undefined ? undefined : { scope: scope as PermissionScopeDetails['scope'] };
}
