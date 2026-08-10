import jwt from 'jsonwebtoken';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: {
    JWT_EXPIRES_IN: '3650d',
    JWT_SECRET: 'production-test-secret-at-least-16-chars',
    NODE_ENV: 'production',
  },
}));

import {
  generateRefreshTokenString,
  hashRefreshToken,
  newFamilyId,
  parseDurationToSeconds,
  signAccessToken,
  verifyAccessToken,
} from '../../src/shared/utils/jwt';

const payload = {
  sub: '91',
  userType: 'operator' as const,
  roles: ['factory_operator'],
  scopes: { 'factories:view': 'OWN_FACTORY' },
};

describe('production access-token lifetime', () => {
  it('uses the configured lifetime without a hidden production cap', () => {
    const decoded = jwt.decode(signAccessToken(payload));

    expect(decoded).not.toBeNull();
    expect(typeof decoded).toBe('object');
    if (!decoded || typeof decoded === 'string') throw new Error('JWT payload was not decoded');
    expect(Number(decoded.exp) - Number(decoded.iat)).toBe(3650 * 24 * 60 * 60);
  });

  it('accepts an unexpired token issued more than fifteen minutes ago', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const legacyToken = jwt.sign(
      {
        ...payload,
        iat: nowSeconds - 15 * 60 - 1,
      },
      'production-test-secret-at-least-16-chars',
      { expiresIn: '3650d' },
    );

    expect(verifyAccessToken(legacyToken)).toEqual(
      expect.objectContaining({
        sub: payload.sub,
        userType: payload.userType,
        roles: payload.roles,
        scopes: payload.scopes,
      }),
    );
  });

  it('still rejects a token after its configured expiry', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredToken = jwt.sign(
      {
        ...payload,
        iat: nowSeconds - 2 * 60,
      },
      'production-test-secret-at-least-16-chars',
      { expiresIn: '1m' },
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow('jwt expired');
  });
});

describe('JWT utility primitives', () => {
  it('parses supported duration formats and rejects invalid values', () => {
    expect(parseDurationToSeconds('15m')).toBe(15 * 60);
    expect(parseDurationToSeconds('2 h')).toBe(2 * 60 * 60);
    expect(parseDurationToSeconds('900')).toBe(900);
    expect(() => parseDurationToSeconds('forever')).toThrow('Invalid duration: forever');
  });

  it('generates opaque refresh-token values, hashes, and family IDs', () => {
    const refreshToken = generateRefreshTokenString();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    expect(Buffer.from(refreshToken, 'base64url')).toHaveLength(48);
    expect(refreshTokenHash).toHaveLength(32);
    expect(refreshTokenHash.equals(hashRefreshToken(refreshToken))).toBe(true);
    expect(refreshTokenHash.equals(hashRefreshToken(`${refreshToken}x`))).toBe(false);
    expect(newFamilyId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
