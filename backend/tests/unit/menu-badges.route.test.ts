import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { authService } from '../../src/modules/auth/auth.service';
import { db } from '../../src/config/database';
import { UnauthorizedError } from '../../src/shared/errors/AppError';
import { signAccessToken } from '../../src/shared/utils/jwt';
import type { AuthenticatedUser } from '../../src/shared/types/express';

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const emptyBadges = {
  factories: false,
  connection: false,
  kwp_forms: false,
  bod_cod_errors: false,
  eligible_factories: false,
  notifications: false,
};
let current: AuthenticatedUser;
let token: string;

beforeEach(() => {
  current = { id: 42, userType: 'officer', roles: ['diw_central'], scopes: {} };
  token = signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['admin'],
    scopes: { 'factories:view': 'ALL', 'factories:approve': 'ALL' },
  });
  jest
    .spyOn(authService, 'getAuthorizationContext')
    .mockImplementation(async () => structuredClone(current));
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/v1/me/menu-badges', () => {
  it('returns exactly six boolean keys for the current account without menu access', async () => {
    const response = await request(createApp())
      .get('/api/v1/me/menu-badges')
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: emptyBadges });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(authService.getAuthorizationContext).toHaveBeenCalledWith(42, { userType: 'officer' });
  });

  it.each([undefined, 'invalid.signature.token'])(
    'requires valid authentication (%s)',
    async (value) => {
      const pending = request(createApp()).get('/api/v1/me/menu-badges');
      if (value) pending.auth(value, { type: 'bearer' });
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
      expect(authService.getAuthorizationContext).not.toHaveBeenCalled();
    },
  );

  it('rejects a suspended account with an existing token', async () => {
    jest
      .mocked(authService.getAuthorizationContext)
      .mockRejectedValue(new UnauthorizedError('Account unavailable'));
    const response = await request(createApp())
      .get('/api/v1/me/menu-badges')
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(401);
  });

  it('ignores supplied user, role, scope and pagination instead of trusting them', async () => {
    const response = await request(createApp())
      .get('/api/v1/me/menu-badges?userId=999&roleCode=admin&scope=ALL&page=2')
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: emptyBadges });
  });

  it('returns a generic error when badge queries fail instead of reporting no work', async () => {
    current.scopes = { 'factories:view': 'ALL', 'factories:approve': 'ALL' };
    jest.spyOn(db.client, 'runner').mockImplementation(() => ({
      run: async () => {
        throw new Error('private SQL connection details');
      },
    }));
    const response = await request(createApp())
      .get('/api/v1/me/menu-badges')
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
    expect(JSON.stringify(response.body)).not.toContain('SQL');
  });

  it('reloads permissions and checks current data on each call using the same token', async () => {
    jest.spyOn(db.client, 'runner').mockImplementation(() => ({ run: async () => ({ id: 1 }) }));
    const app = createApp();
    const before = await request(app).get('/api/v1/me/menu-badges').auth(token, { type: 'bearer' });
    expect(before.body.data.notifications).toBe(false);
    current.scopes = { 'notifications:view': 'ALL' };
    const granted = await request(app)
      .get('/api/v1/me/menu-badges')
      .auth(token, { type: 'bearer' });
    expect(granted.body.data.notifications).toBe(true);
    current.scopes = {};
    const revoked = await request(app)
      .get('/api/v1/me/menu-badges')
      .auth(token, { type: 'bearer' });
    expect(revoked.body.data.notifications).toBe(false);
  });
});
