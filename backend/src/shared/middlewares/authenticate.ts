import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';
import { authService } from '../../modules/auth/auth.service';

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
    req.user = await authService.getAuthorizationContext(userId, {
      userType: payload.userType,
    });
    return next();
  } catch (err) {
    return next(err);
  }
}
