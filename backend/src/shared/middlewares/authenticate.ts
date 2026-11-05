import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';
import { authService } from '../../modules/auth/auth.service';
import { applyOfficerPermissionPolicy } from '../../modules/auth/officer-permission-policy';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }
  const token = header.slice('Bearer '.length).trim();
  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return next(new UnauthorizedError(err instanceof Error ? err.message : 'Invalid token'));
  }

  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return next(new UnauthorizedError('Invalid token identity'));
  }

  try {
    const user = await authService.getAuthorizationContext(userId, {
      userType: payload.userType,
    });
    req.user = applyOfficerPermissionPolicy(user);
    return next();
  } catch (err) {
    return next(err);
  }
}
