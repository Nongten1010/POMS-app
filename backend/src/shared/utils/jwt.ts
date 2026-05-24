import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  sub: string; // user id (as string)
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  /** permissionCode → scope (null = no scope dimension) */
  scopes: Record<string, string | null>;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string; // refresh_tokens.id (as string)
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): Buffer {
  return crypto.createHash('sha256').update(token).digest();
}

export function newFamilyId(): string {
  return crypto.randomUUID();
}

/** Parse human-readable duration string (e.g. "15m", "7d") → seconds */
export function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(input.trim());
  if (!match) {
    const n = Number(input);
    if (!Number.isNaN(n)) return n;
    throw new Error(`Invalid duration: ${input}`);
  }
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
  return n * mult;
}
