import type { AccessTokenPayload } from '../utils/jwt';
import type { PermissionScopeDetails } from '../../modules/auth/permissions';

/**
 * Augment Express Request with `req.user` populated by `authenticate` middleware
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: number;
  userType: AccessTokenPayload['userType'];
  roles: string[];
  scopes: Record<string, string | null>;
  scopeDetails?: Record<string, PermissionScopeDetails>;
  regionalAccess?: AccessTokenPayload['regionalAccess'];
}

export {};
