import jwt from 'jsonwebtoken';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: {
    JWT_EXPIRES_IN: '3650d',
    JWT_SECRET: 'production-test-secret-at-least-16-chars',
    NODE_ENV: 'production',
  },
}));

import { signAccessToken, verifyAccessToken } from '../../src/shared/utils/jwt';

const payload = {
  sub: '91',
  userType: 'operator' as const,
  roles: ['factory_operator'],
  scopes: { 'factories:view': 'OWN_FACTORY' },
};

describe('production access-token lifetime', () => {
  it('caps newly signed access tokens at fifteen minutes', () => {
    const decoded = jwt.decode(signAccessToken(payload));

    expect(decoded).not.toBeNull();
    expect(typeof decoded).toBe('object');
    if (!decoded || typeof decoded === 'string') throw new Error('JWT payload was not decoded');
    expect(Number(decoded.exp) - Number(decoded.iat)).toBe(15 * 60);
  });

  it('rejects a previously issued long-lived token after fifteen minutes', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const legacyToken = jwt.sign(
      {
        ...payload,
        iat: nowSeconds - 15 * 60 - 1,
      },
      'production-test-secret-at-least-16-chars',
      { expiresIn: '3650d' },
    );

    expect(() => verifyAccessToken(legacyToken)).toThrow('Access token lifetime exceeded');
  });
});
