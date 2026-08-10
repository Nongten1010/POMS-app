import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import type { PermissionScopeDetails } from '../../modules/auth/permissions';
import type { RegionalAccessDTO } from '../../modules/auth/regional-access';

const MAX_PRODUCTION_ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  sub: string; // user id (as string)
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  /** permissionCode → scope (null = no scope dimension) */
  scopes: Record<string, string | null>;
  /** permissionCode → detailed menu scope, including region/province selections */
  scopeDetails?: Record<string, PermissionScopeDetails>;
  /** จำกัดข้อมูลตามภาคที่เจ้าหน้าที่รับผิดชอบ; undefined/null = ไม่จำกัดเพิ่ม */
  regionalAccess?: RegionalAccessDTO | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const configuredLifetime = parseDurationToSeconds(env.JWT_EXPIRES_IN);
  const expiresIn =
    env.NODE_ENV === 'production'
      ? Math.min(configuredLifetime, MAX_PRODUCTION_ACCESS_TOKEN_LIFETIME_SECONDS)
      : configuredLifetime;
  const opts: SignOptions = { expiresIn };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  if (
    env.NODE_ENV === 'production' &&
    (typeof decoded.iat !== 'number' ||
      Math.floor(Date.now() / 1000) - decoded.iat > MAX_PRODUCTION_ACCESS_TOKEN_LIFETIME_SECONDS)
  ) {
    throw new Error('Access token lifetime exceeded');
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
  const rawNumber = match[1];
  const rawUnit = match[2]?.toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  if (!rawNumber || !rawUnit || !(rawUnit in multipliers)) {
    throw new Error(`Invalid duration: ${input}`);
  }
  return Number(rawNumber) * multipliers[rawUnit as keyof typeof multipliers];
}
