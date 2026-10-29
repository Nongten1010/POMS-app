import request from 'supertest';
import bcrypt from 'bcrypt';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { logger } from '../../src/config/logger';
import { verifyAccessToken } from '../../src/shared/utils/jwt';
import type { KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';
import { createAuthLoginApiFixture } from '../helpers/auth-login-api-fixture';

const syntheticUsername = '1111111111111';
const localPassword = 'synthetic-local*';
const externalPassword = 'synthetic-external*';
const upstream = jest.fn<typeof fetch>();
const previousConfig = {
  enabled: env.DIW_USER_LOGIN_ENABLED,
  clientId: env.DIW_USER_LOGIN_CLIENT_ID,
  url: env.DIW_USER_LOGIN_URL,
};

describe('POST /api/v1/auth/login local identity precedence', () => {
  let fixture: KnexSqliteFixture;
  let passwordHash: string;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let requestNumber = 0;
  const authLogs: Record<string, unknown>[] = [];
  const captureLog = (entry: Record<string, unknown>) => authLogs.push(entry);

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(localPassword, 4);
    env.DIW_USER_LOGIN_ENABLED = true;
    env.DIW_USER_LOGIN_CLIENT_ID = 'synthetic-test-client';
    env.DIW_USER_LOGIN_URL = 'https://diw.example.invalid/login';
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((...args) => upstream(...args));
  });

  beforeEach(async () => {
    authLogs.length = 0;
    logger.on('data', captureLog);
    upstream.mockReset();
    upstream.mockImplementation(
      async () =>
        new Response(JSON.stringify([{ citizen_id: syntheticUsername, status: 'false' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    fixture = await createAuthLoginApiFixture(db, syntheticUsername, passwordHash);
  });

  afterEach(() => {
    fixture.close();
    logger.removeListener('data', captureLog);
  });

  afterAll(() => {
    fetchSpy.mockRestore();
    env.DIW_USER_LOGIN_ENABLED = previousConfig.enabled;
    env.DIW_USER_LOGIN_CLIENT_ID = previousConfig.clientId;
    env.DIW_USER_LOGIN_URL = previousConfig.url;
  });

  function login(password: string) {
    requestNumber += 1;
    return request(createApp())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', `198.51.100.${requestNumber}`)
      .send({ userType: 'operator', username: syntheticUsername, password });
  }

  it('rejects an incorrect local password without sending credentials to DIW', async () => {
    const response = await login(externalPassword);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps a deleted local identity from falling through to DIW', async () => {
    fixture.execute('UPDATE users SET deleted_at = ? WHERE id = ?', [
      '2026-01-01T00:00:00.000Z',
      1,
    ]);

    const response = await login(externalPassword);

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('uses the current local identity when a deleted account has the same username', async () => {
    fixture.execute('UPDATE users SET deleted_at = ?, password_hash = NULL WHERE id = 1', [
      '2026-01-01T00:00:00.000Z',
    ]);
    fixture.execute(
      `INSERT INTO users (id, identity_provider, external_id, username, user_type, is_active,
        deleted_at, password_hash, permission_mode, first_name, last_name)
       VALUES (2, 'local', ?, ?, 'operator', 1, NULL, ?, 'role_default', 'ผู้ใช้ใหม่', 'ทดสอบ')`,
      [syntheticUsername, syntheticUsername, passwordHash],
    );
    fixture.execute('INSERT INTO user_roles (user_id, role_id) VALUES (2, 1)');

    const response = await login(localPassword);

    expect(response.status).toBe(200);
    expect(verifyAccessToken(response.body.accessToken).sub).toBe('2');
    expect(response.body.user.accountType).toBe('poms');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('does not let an explicit API hint bypass an existing local identity', async () => {
    const response = await login(externalPassword).send({ accountType: 'api' });

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('authenticates a valid local password containing a star without DIW', async () => {
    const response = await login(localPassword);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      username: syntheticUsername,
      accountType: 'poms',
      userType: 'operator',
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', 'UPDATE users SET is_active = 0 WHERE id = 1'],
    ['missing password hash', 'UPDATE users SET password_hash = NULL WHERE id = 1'],
    ['different persona', "UPDATE users SET user_type = 'citizen' WHERE id = 1"],
  ])('rejects a local identity that is %s without DIW', async (_state, sql) => {
    fixture.execute(sql);

    const response = await login(localPassword);

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps POMS precedence when an API hint accompanies valid local credentials', async () => {
    const response = await login(localPassword).send({ accountType: 'api' });

    expect(response.status).toBe(200);
    expect(response.body.user.accountType).toBe('poms');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('asks DIW when no local identity exists and keeps its denial generic', async () => {
    fixture.execute('DELETE FROM users');

    const response = await login(externalPassword);

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('still verifies a previously synced i-Industry identity with DIW', async () => {
    fixture.execute('UPDATE users SET identity_provider = ?, password_hash = NULL WHERE id = ?', [
      'i_industry',
      1,
    ]);

    const response = await login(externalPassword);

    expect(response.status).toBe(401);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('provisions a DIW-confirmed operator and preserves the same identity on repeat login', async () => {
    fixture.execute('DELETE FROM user_roles');
    fixture.execute('DELETE FROM users');
    upstream.mockImplementation(async () => successfulDiwResponse());

    const first = await login(externalPassword);
    const second = await login(externalPassword);

    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({
      accountType: 'api',
      userType: 'operator',
      roleCodes: ['factory_operator'],
      ownedFactoryIds: ['FACTORY-TEST-1'],
    });
    expect(second.status).toBe(200);
    expect(verifyAccessToken(first.body.accessToken).sub).toBe('1');
    expect(verifyAccessToken(second.body.accessToken).sub).toBe('1');
    expect(second.body.user.ownedFactoryIds).toEqual(['FACTORY-TEST-1']);
  });

  it('keeps an explicit local-only login local when that account is absent', async () => {
    fixture.execute('DELETE FROM users');

    const response = await login(externalPassword).send({ accountType: 'poms' });

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('correlates local rejection logs without recording submitted credentials', async () => {
    const response = await login(externalPassword);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(authLogs).toContainEqual(
      expect.objectContaining({
        requestId: response.headers['x-request-id'],
        provider: 'local',
        reason: 'local_credentials_rejected',
      }),
    );
    const serialized = JSON.stringify(authLogs);
    for (const secret of [
      syntheticUsername,
      localPassword,
      externalPassword,
      'synthetic-test-client',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('keeps concurrent DIW login logs correlated with server-generated request IDs', async () => {
    fixture.execute('DELETE FROM users');

    const responses = await Promise.all([
      login(externalPassword).set('X-Request-Id', 'untrusted-client-value'),
      login(externalPassword).set('X-Request-Id', 'untrusted-client-value'),
    ]);

    const requestIds = responses.map((response) => response.headers['x-request-id']);
    expect(new Set(requestIds).size).toBe(2);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      const decisions = authLogs.filter(
        (entry) => entry.requestId === response.headers['x-request-id'],
      );
      expect(decisions.map((entry) => entry.reason)).toEqual([
        'local_identity_not_found',
        'diw_rejected',
      ]);
    }
    expect(JSON.stringify(authLogs)).not.toContain(externalPassword);
    expect(JSON.stringify(authLogs)).not.toContain('untrusted-client-value');
  });
});

function successfulDiwResponse() {
  return new Response(
    JSON.stringify([
      {
        status: 'true',
        citizen_id: syntheticUsername,
        userCode: 'SYNTHETIC-OPERATOR',
        userFirstName: 'ผู้ใช้สมมติ',
        userLastName: 'ทดสอบ',
        juristic: [
          {
            JuristicID: 'SYNTHETIC-JURISTIC',
            JuristicNameTh: 'กิจการสมมติ',
            FactoryList: [
              {
                FID: 'FACTORY-TEST-1',
                CODE: 'REG-TEST-1',
                FNAME: 'โรงงานสมมติ',
                PROVINCE_ID: '1000',
              },
            ],
          },
        ],
      },
    ]),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
