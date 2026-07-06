import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: Number(payload.sub),
      userType: payload.userType,
      roles: payload.roles,
      scopes: payload.scopes,
      scopeDetails: payload.scopeDetails ?? undefined,
      regionalAccess: payload.regionalAccess ?? null,
    };
    return next();
  } catch (err) {
    return next(new UnauthorizedError(err instanceof Error ? err.message : 'Invalid token'));
  }
}
