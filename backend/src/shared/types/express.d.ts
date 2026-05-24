import type { AccessTokenPayload } from '../utils/jwt';

/**
 * Augment Express Request with `req.user` populated by `authenticate` middleware
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
}

export {};
