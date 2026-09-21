import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDatabase = jest.fn();
const mockTransaction = jest.fn<() => Promise<unknown>>();
jest.mock('../../src/config/database', () => ({
  db: Object.assign(mockDatabase, { transaction: mockTransaction }),
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/shared/utils/password', () => ({
  hashPassword: jest.fn(async () => 'test-hash'),
}));

import { usersRepository } from '../../src/modules/users/users.repository';
import { usersRoutes } from '../../src/modules/users/users.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { logger } from '../../src/config/logger';

interface IdentityRow {
  id: number;
  identity_provider: string;
  external_id: string;
  deleted_at: string | null;
}

// Execute identity predicates against rows, including the soft-deleted row that
// still owns its key in uq_users_provider. Never connect to a real database.
function identityQuery(rows: IdentityRow[]) {
  let matches = [...rows];
  const query = {
    where(values: Partial<IdentityRow>) {
      matches = matches.filter((row) =>
        Object.entries(values).every(([key, value]) => row[key as keyof IdentityRow] === value),
      );
      return query;
    },
    whereNull(column: keyof IdentityRow) {
      matches = matches.filter((row) => row[column] === null);
      return query;
    },
    whereNot(column: keyof IdentityRow, value: unknown) {
      matches = matches.filter((row) => row[column] !== value);
      return query;
    },
    select() {
      return query;
    },
    first() {
      return query;
    },
    then(resolve: (row: { id: number } | undefined) => unknown, reject: (err: unknown) => unknown) {
      return Promise.resolve(matches[0] ? { id: matches[0].id } : undefined).then(resolve, reject);
    },
  };
  return query;
}

const existing: IdentityRow = {
  id: 14,
  identity_provider: 'local',
  external_id: 'deleted_officer',
  deleted_at: '2026-09-21T00:00:00Z',
};
const conflictBody = {
  success: false,
  error: { code: 'CONFLICT', message: 'External ID already exists' },
};
const duplicateMessage =
  "Cannot insert duplicate key row in object 'dbo.users' with unique index 'uq_users_provider'.";
const payload = () => ({
  user: {
    fullName: 'เจ้าหน้าที่ทดสอบ',
    username: existing.external_id,
    password: randomUUID(),
    department: 'กรมโรงงานอุตสาหกรรม',
    lineNameTh: 'ผู้ทดสอบ',
    levelNameTh: 'เจ้าหน้าที่ ภาคกลาง',
    roleCodes: ['monitoring_kpm'],
    isActive: true,
    userType: 'officer',
  },
  permissions: {},
});

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v1/users', usersRoutes);
  instance.use(errorHandler);
  return instance;
}

function token(scopes: Record<string, string | null> = { 'users:edit': null }) {
  return signAccessToken({ sub: '1', userType: 'officer', roles: ['admin'], scopes });
}

describe('managed user identity conflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.mockImplementation(() => identityQuery([existing]));
    mockTransaction.mockRejectedValue(Object.assign(new Error(duplicateMessage), { number: 2601 }));
    jest
      .spyOn(usersRepository, 'findRolesByCodes')
      .mockResolvedValue([
        { id: 3, code: 'monitoring_kpm', name_th: 'เจ้าหน้าที่ศูนย์เฝ้า', name_en: 'Monitoring' },
      ]);
    jest.spyOn(usersRepository, 'getRolePermissionsByRoleCodes').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([null, existing.deleted_at])(
    'returns 409 for an existing key (deleted_at=%s)',
    async (deletedAt) => {
      mockDatabase.mockImplementation(() =>
        identityQuery([{ ...existing, deleted_at: deletedAt }]),
      );
      const response = await request(app())
        .post('/api/v1/users/local-accounts')
        .set('Authorization', `Bearer ${token()}`)
        .send(payload());

      expect(response.status).toBe(409);
      expect(response.body).toEqual(conflictBody);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it('keeps the provider boundary and excludes only the user being edited', async () => {
    await expect(usersRepository.findByExternalId('local', existing.external_id)).resolves.toEqual({
      id: 14,
    });
    await expect(
      usersRepository.findByExternalId('local', existing.external_id, 14),
    ).resolves.toBeUndefined();
    await expect(
      usersRepository.findByExternalId('diw', existing.external_id),
    ).resolves.toBeUndefined();
  });

  it('rejects a soft-deleted identity through the managed-user creation endpoint', async () => {
    const response = await request(app())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        username: existing.external_id,
        userType: 'officer',
        firstName: 'ทดสอบ',
        lastName: 'บัญชี',
        isActive: true,
        roleCodes: ['monitoring_kpm'],
      });
    expect(response.status).toBe(409);
    expect(response.body).toEqual(conflictBody);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects renaming an account to a soft-deleted identity before updating it', async () => {
    jest.spyOn(usersRepository, 'findById').mockResolvedValue({
      id: 22,
      identityProvider: 'local',
      username: 'current_officer',
      externalId: 'current_officer',
      roleCodes: ['monitoring_kpm'],
    } as never);
    const response = await request(app())
      .patch('/api/v1/users/22')
      .set('Authorization', `Bearer ${token()}`)
      .send({ username: existing.external_id });
    expect(response.status).toBe(409);
    expect(response.body).toEqual(conflictBody);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    { number: 2601, message: duplicateMessage },
    { number: 2627, message: "Violation of UNIQUE KEY constraint 'uq_users_provider'." },
    { originalError: { number: 2601, message: duplicateMessage } },
    { originalError: { info: { number: 2627, message: duplicateMessage } } },
  ])('returns a safe 409 when a concurrent insert wins the identity key: %j', async (error) => {
    mockDatabase.mockImplementation(() => identityQuery([]));
    mockTransaction.mockRejectedValue(error);
    const response = await request(app())
      .post('/api/v1/users/local-accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send(payload());

    expect(response.status).toBe(409);
    expect(response.body).toEqual(conflictBody);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    { number: 2601, message: "Duplicate key with unique index 'unrelated_index'." },
    { number: 547, message: duplicateMessage },
    new Error('Database connection failed'),
  ])('does not relabel unrelated failures as identity conflicts: %j', async (error) => {
    mockDatabase.mockImplementation(() => identityQuery([]));
    mockTransaction.mockRejectedValue(error);
    const response = await request(app())
      .post('/api/v1/users/local-accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send(payload());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it.each(['create', 'update'] as const)(
    'also translates identity races during %s',
    async (method) => {
      const operation =
        method === 'create'
          ? usersRepository.create(
              {
                username: 'new_officer',
                userType: 'officer',
                firstName: 'ทดสอบ',
                lastName: '',
                isActive: true,
                roleCodes: ['monitoring_kpm'],
              },
              1,
            )
          : usersRepository.update(22, { username: existing.external_id }, 1);
      await expect(operation).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'External ID already exists',
      });
    },
  );

  it('rejects invalid payloads before looking up identity', async () => {
    const input = payload();
    input.user.username = '';
    const response = await request(app())
      .post('/api/v1/users/local-accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send(input);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockDatabase).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('preserves 201 and Location for a new account', async () => {
    mockDatabase.mockImplementation(() => identityQuery([]));
    mockTransaction.mockResolvedValue({ id: 22, username: 'new_officer' });
    const input = payload();
    input.user.username = 'new_officer';
    const response = await request(app())
      .post('/api/v1/users/local-accounts')
      .set('Authorization', `Bearer ${token({ 'permissions:manage': null })}`)
      .send(input);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/users/22');
    expect(response.body.data.username).toBe('new_officer');
    expect(response.body.data).not.toHaveProperty('password');
  });

  it.each([undefined, token({ 'users:view': null })])(
    'checks authentication and authorization before looking up identity',
    async (bearer) => {
      const pending = request(app()).post('/api/v1/users/local-accounts');
      if (bearer) pending.set('Authorization', `Bearer ${bearer}`);
      const response = await pending.send(payload());
      expect(response.status).toBe(bearer ? 403 : 401);
      expect(mockDatabase).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );
});
