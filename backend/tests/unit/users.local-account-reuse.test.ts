import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockDatabase = jest.fn<(table: string) => unknown>();
const mockTransaction =
  jest.fn<(callback: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown>>();
const mockRaw = jest.fn((sql: string) => {
  if (sql !== 'SYSDATETIME()') throw new Error(`Unexpected SQL: ${sql}`);
  return '2026-09-21T12:00:00Z';
});
jest.mock('../../src/config/database', () => ({
  db: Object.assign(mockDatabase, { transaction: mockTransaction, raw: mockRaw }),
}));
jest.mock('../../src/config/env', () => ({
  env: {
    BCRYPT_SALT_ROUNDS: 4,
    JWT_SECRET: jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .randomBytes(32)
      .toString('hex'),
    JWT_EXPIRES_IN: '15m',
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/modules/auth/identity-provider', () => ({
  getIdentityProvider: () => {
    throw new Error('Local login must not call an external provider');
  },
}));

import { authRepository, type OfficerProfileRow } from '../../src/modules/auth/auth.repository';
import { authService } from '../../src/modules/auth/auth.service';
import { usersRepository } from '../../src/modules/users/users.repository';
import { usersService } from '../../src/modules/users/users.service';
import type { ManagedUserDetailDTO } from '../../src/modules/users/users.types';
import { hashPassword, verifyPassword } from '../../src/shared/utils/password';
import { verifyAccessToken } from '../../src/shared/utils/jwt';

type Row = Record<string, unknown>;
type Tables = Record<'users' | 'officer_profiles' | 'user_roles' | 'user_permissions', Row[]>;

function copyRows(rows: Row[]): Row[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        Buffer.isBuffer(value) ? Buffer.from(value) : value,
      ]),
    ),
  );
}

// Only the query operations used by these repositories are available. Predicates
// run against stored rows; an unstubbed query/table fails instead of reaching SQL.
function queryTable(tables: Tables, table: keyof Tables) {
  const predicates: Array<(row: Row) => boolean> = [];
  let columns: string[] = [];
  let first = false;
  let operation: 'read' | 'insert' | 'delete' | 'update' = 'read';
  let inserted: Row[] = [];
  let patch: Row = {};
  let result: Promise<unknown> | undefined;
  const matches = () => tables[table].filter((row) => predicates.every((test) => test(row)));
  const project = (row: Row) =>
    columns.length === 0
      ? { ...row }
      : Object.fromEntries(columns.map((column) => [column, row[column]]));
  const query = {
    where(values: Row) {
      predicates.push((row) => Object.entries(values).every(([key, value]) => row[key] === value));
      return query;
    },
    whereNull(column: string) {
      predicates.push((row) => row[column] === null);
      return query;
    },
    whereNot(column: string, value: unknown) {
      predicates.push((row) => row[column] !== value);
      return query;
    },
    select(...selected: string[]) {
      columns = selected;
      return query;
    },
    first(...selected: string[]) {
      first = true;
      if (selected.length > 0) columns = selected;
      return query;
    },
    insert(values: Row | Row[]) {
      operation = 'insert';
      inserted = Array.isArray(values) ? values : [values];
      return query;
    },
    returning(column: string) {
      columns = [column];
      return query;
    },
    del() {
      operation = 'delete';
      return query;
    },
    update(values: Row) {
      operation = 'update';
      patch = values;
      return query;
    },
    then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
      result ??= Promise.resolve().then(() => {
        if (operation === 'insert') {
          const rows = inserted.map((row) =>
            table === 'users'
              ? {
                  id: Math.max(0, ...tables.users.map((user) => Number(user.id))) + 1,
                  deleted_at: null,
                  ...row,
                }
              : { ...row },
          );
          tables[table].push(...rows);
          return rows.map(project);
        }
        const rows = matches();
        if (operation === 'delete') {
          tables[table] = tables[table].filter((row) => !rows.includes(row));
          return rows.length;
        }
        if (operation === 'update') {
          rows.forEach((row) => Object.assign(row, patch));
          return rows.length;
        }
        return first ? (rows[0] ? project(rows[0]) : undefined) : rows.map(project);
      });
      return result.then(resolve, reject);
    },
  };
  return query;
}

function installFixture(tables: Tables) {
  mockDatabase.mockImplementation((table) => {
    if (!Object.hasOwn(tables, table)) throw new Error(`Unexpected table: ${table}`);
    return queryTable(tables, table as keyof Tables);
  });
  mockTransaction.mockImplementation(async (callback) => {
    const before = Object.fromEntries(
      Object.entries(tables).map(([key, rows]) => [key, copyRows(rows)]),
    );
    try {
      return await callback(
        Object.assign(mockDatabase, { raw: mockRaw }) as unknown as Knex.Transaction,
      );
    } catch (error) {
      Object.assign(tables, before);
      throw error;
    }
  });
  const roles = [
    { id: 1, code: 'admin', name_th: 'ผู้ดูแล', name_en: 'Admin' },
    { id: 3, code: 'monitoring_kpm', name_th: 'เจ้าหน้าที่ศูนย์เฝ้า', name_en: 'Monitoring' },
  ];
  const roleCodesFor = (userId: number) =>
    tables.user_roles
      .filter((row) => row.user_id === userId)
      .map((row) => {
        const role = roles.find((candidate) => candidate.id === row.role_id);
        if (!role) throw new Error(`Unknown fixture role: ${row.role_id}`);
        return role.code;
      });

  jest
    .spyOn(usersRepository, 'findRolesByCodes')
    .mockImplementation(async (codes) => roles.filter((role) => codes.includes(role.code)));
  // Joined readbacks are scoped to the requested user ID. Identity lookup,
  // transaction writes, password hashing and login checks remain real code.
  jest.spyOn(usersRepository, 'findById').mockImplementation(async (userId) => {
    const row = tables.users.find((user) => user.id === userId && user.deleted_at === null);
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      externalId: row.external_id,
      identityProvider: row.identity_provider,
      roleCodes: roleCodesFor(userId),
    } as ManagedUserDetailDTO;
  });
  jest
    .spyOn(authRepository, 'getOfficerProfile')
    .mockImplementation(
      async (userId) =>
        tables.officer_profiles.find(
          (profile) => profile.user_id === userId,
        ) as unknown as OfficerProfileRow,
    );
  jest.spyOn(authRepository, 'getRolesAndPermissions').mockImplementation(async (userId) => ({
    roles: roleCodesFor(userId),
    scopes: Object.fromEntries(
      tables.user_permissions
        .filter((permission) => permission.user_id === userId)
        .map((permission) => [String(permission.code), null]),
    ),
  }));
}

describe('reusing a deleted local account username', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates a fresh identity and uses only its new password, profile and assignments', async () => {
    const oldPassword = randomUUID();
    const newPassword = randomUUID();
    const tables: Tables = {
      users: [
        {
          id: 14,
          identity_provider: 'local',
          external_id: 'officer_rc',
          username: 'officer_rc',
          user_type: 'officer',
          first_name: 'บัญชีเดิม',
          last_name: '',
          is_active: false,
          password_hash: Buffer.from(await hashPassword(oldPassword)),
          deleted_at: '2026-09-20T12:00:00Z',
        },
      ],
      officer_profiles: [
        { user_id: 14, department_name_th: 'หน่วยงานเดิม', line_name_th: 'ตำแหน่งเดิม' },
      ],
      user_roles: [{ user_id: 14, role_id: 1, assigned_by: 1 }],
      user_permissions: [{ user_id: 14, permission_id: 9, code: 'users:edit', effect: 'allow' }],
    };
    const original = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, copyRows(rows)]),
    );
    installFixture(tables);
    const credentials = {
      username: 'officer_rc',
      userType: 'officer' as const,
      accountType: 'poms' as const,
    };

    await expect(
      authRepository.findUserByProviderAndExternalId('local', 'officer_rc'),
    ).resolves.toBeUndefined();
    await expect(
      authService.loginLocal({ ...credentials, password: oldPassword }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    const created = await usersService.createLocalAccount(
      {
        username: 'officer_rc',
        fullName: 'เจ้าหน้าที่บัญชีใหม่',
        userType: 'officer',
        password: newPassword,
        isActive: true,
        roleCodes: ['monitoring_kpm'],
        profile: { departmentNameTh: 'หน่วยงานใหม่', lineNameTh: 'ตำแหน่งใหม่' },
      },
      1,
    );

    expect(created.id).not.toBe(14);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(created).toMatchObject({ username: 'officer_rc', roleCodes: ['monitoring_kpm'] });
    expect(tables.users).toHaveLength(2);
    expect(tables.officer_profiles.find((row) => row.user_id === created.id)).toMatchObject({
      department_name_th: 'หน่วยงานใหม่',
      line_name_th: 'ตำแหน่งใหม่',
    });
    expect(tables.user_roles.filter((row) => row.user_id === created.id)).toEqual([
      { user_id: created.id, role_id: 3, assigned_by: 1 },
    ]);
    expect(tables.user_permissions.filter((row) => row.user_id === created.id)).toEqual([]);
    const stored = tables.users.find((row) => row.id === created.id);
    if (!stored) throw new Error('New user was not inserted');
    expect(Buffer.isBuffer(stored.password_hash)).toBe(true);
    const storedHash = (stored.password_hash as Buffer).toString('utf8');
    expect(storedHash).not.toBe(newPassword);
    await expect(verifyPassword(newPassword, storedHash)).resolves.toBe(true);
    await expect(verifyPassword(oldPassword, storedHash)).resolves.toBe(false);
    await expect(
      authRepository.findUserByProviderAndExternalId('local', 'officer_rc'),
    ).resolves.toMatchObject({
      id: created.id,
      deleted_at: null,
    });
    await expect(
      authService.loginLocal({ ...credentials, password: oldPassword }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    const login = await authService.loginLocal({ ...credentials, password: newPassword });
    expect(login.user).toMatchObject({
      username: 'officer_rc',
      fullName: 'เจ้าหน้าที่บัญชีใหม่',
      roleCodes: ['monitoring_kpm'],
      department: 'หน่วยงานใหม่',
      lineNameTh: 'ตำแหน่งใหม่',
    });
    expect(verifyAccessToken(login.accessToken)).toMatchObject({
      sub: String(created.id),
      roles: ['monitoring_kpm'],
      scopes: {},
    });
    expect(tables.users.filter((row) => row.id === 14)).toEqual(original.users);
    for (const table of ['officer_profiles', 'user_roles', 'user_permissions'] as const) {
      expect(tables[table].filter((row) => row.user_id === 14)).toEqual(original[table]);
    }
    await expect(
      usersService.createLocalAccount(
        {
          username: 'officer_rc',
          fullName: 'ชื่อซ้ำ',
          userType: 'officer',
          password: randomUUID(),
          isActive: true,
          roleCodes: ['monitoring_kpm'],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
