import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/AppError';

const API_KEY_HEADER = 'x-api-key';

export function authenticateIntegrationApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const apiKey = req.get(API_KEY_HEADER)?.trim();
  if (!apiKey) {
    return next(new UnauthorizedError('Missing X-API-Key header'));
  }

  if (!isAllowedApiKey(apiKey)) {
    return next(new UnauthorizedError('Invalid integration API key'));
  }

  return next();
}

function isAllowedApiKey(apiKey: string): boolean {
  const allowedKeys = (process.env.INTEGRATION_API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  return allowedKeys.some((allowedKey) => safeEquals(apiKey, allowedKey));
}

function safeEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
