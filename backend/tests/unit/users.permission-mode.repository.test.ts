import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockDatabase = jest.fn<(table: string) => unknown>();
const mockTransaction =
  jest.fn<(callback: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown>>();
jest.mock('../../src/config/database', () => ({
  db: Object.assign(mockDatabase, { transaction: mockTransaction, raw: (sql: string) => sql }),
}));
import { usersRepository } from '../../src/modules/users/users.repository';
import { authRepository } from '../../src/modules/auth/auth.repository';
import type { ManagedUserDetailDTO } from '../../src/modules/users/users.types';

interface SavedPermission {
  user_id: number;
  permission_id: number;
  effect: 'allow' | 'deny';
  scope: string | null;
  region_name?: string | null;
  province_id?: string | null;
  estate_code?: string | null;
}
const catalog = [
  { id: 1, code: 'dashboard:view', resource: 'dashboard', action: 'view', description: null },
  {
    id: 2,
    code: 'cems_wpms_requests:approve',
    resource: 'connection',
    action: 'approve',
    description: null,
  },
];
let mode: string;
let saved: SavedPermission[];
let roles: Array<{ code: string; scope: string | null }>;
let audits: Array<Record<string, unknown>>;
let failAudit: boolean;

function query(table: string) {
  let codes: string[] | undefined;
  let result: unknown;
  const chain = {
    from() {
      return chain;
    },
    join() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    whereNull() {
      return chain;
    },
    forUpdate() {
      return chain;
    },
    whereIn(_column: string, values: string[]) {
      codes = values;
      return chain;
    },
    select(...columns: string[]) {
      if (table === 'users') {
        result =
          saved.length > 0
            ? saved.map((row) => ({
                ...row,
                permission_mode: mode,
                code: catalog.find((permission) => permission.id === row.permission_id)?.code,
                province_name: row.province_id === '21' ? 'ระยอง' : null,
              }))
            : [{ permission_mode: mode, code: null, effect: null, scope: null }];
      }
      if (table === 'permissions') result = catalog.filter((row) => codes?.includes(row.code));
      if (table === 'user_roles') {
        result = columns[0] === 'roles.code' ? [{ code: 'officer' }] : roles;
      }
      if (table === 'role_permissions') result = roles;
      if (table === 'user_permissions') {
        result = saved.map((row) => ({
          ...row,
          code: catalog.find((permission) => permission.id === row.permission_id)?.code,
          province_name: row.province_id === '21' ? 'ระยอง' : null,
        }));
      }
      return chain;
    },
    first() {
      result = table === 'users' ? { permission_mode: mode } : { id: 1 };
      return chain;
    },
    async del() {
      if (table === 'user_permissions') saved = [];
      return 1;
    },
    async update(patch: Record<string, unknown>) {
      if (table === 'users' && patch.permission_mode) mode = String(patch.permission_mode);
      return 1;
    },
    insert(rows: SavedPermission[] | Record<string, unknown>) {
      if (table === 'user_permissions') saved.push(...(rows as SavedPermission[]));
      if (table === 'audit_logs') {
        if (failAudit) throw new Error('Fixture audit insert failure');
        audits.push(rows as Record<string, unknown>);
      }
      return chain;
    },
    returning() {
      result = [{ id: 1 }];
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (err: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return chain;
}

beforeEach(() => {
  mode = 'role_default';
  saved = [];
  roles = [{ code: 'dashboard:view', scope: 'OWN_FACTORY' }];
  audits = [];
  failAudit = false;
  mockDatabase.mockImplementation(query);
  mockTransaction.mockImplementation(
    async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
      const before = { mode, saved: structuredClone(saved), audits: structuredClone(audits) };
      const trx = Object.assign(query, { raw: () => 'TEST_NOW' }) as unknown as Knex.Transaction;
      try {
        return await callback(trx);
      } catch (error) {
        mode = before.mode;
        saved = before.saved;
        audits = before.audits;
        throw error;
      }
    },
  );
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('permission storage and authentication', () => {
  it('records actor, mode and stored grants before/after saving and resetting atomically', async () => {
    mode = 'custom';
    saved = [{ user_id: 1, permission_id: 1, effect: 'allow', scope: 'ALL' }];
    await usersRepository.replaceUserPermissionOverrides(1, [], 99);
    expect(audits[0]).toMatchObject({
      actor_user_id: 99,
      action: 'user.permissions.replace',
      target_type: 'users',
      target_id: 1,
    });
    expect(JSON.parse(String(audits[0].metadata))).toMatchObject({
      before: {
        permissionMode: 'custom',
        permissions: [{ code: 'dashboard:view', effect: 'allow', scope: 'ALL' }],
      },
      after: { permissionMode: 'custom', permissions: [] },
    });
    await usersRepository.replaceUserPermissionOverrides(1, [], 99, 'role_default');
    expect(audits[1]).toMatchObject({ action: 'user.permissions.reset' });
    expect(JSON.parse(String(audits[1].metadata))).toMatchObject({
      before: { permissionMode: 'custom' },
      after: { permissionMode: 'role_default' },
    });
  });

  it('rolls back a permission change if its audit record cannot be stored', async () => {
    saved = [{ user_id: 1, permission_id: 1, effect: 'deny', scope: null }];
    failAudit = true;
    await expect(usersRepository.replaceUserPermissionOverrides(1, [], 99)).rejects.toThrow(
      'audit insert failure',
    );
    expect(mode).toBe('role_default');
    expect(saved).toEqual([{ user_id: 1, permission_id: 1, effect: 'deny', scope: null }]);
    expect(audits).toEqual([]);
  });
  it('marks even an empty saved set as custom so role access stays removed', async () => {
    await usersRepository.replaceUserPermissionOverrides(1, [], 99);
    expect(mode).toBe('custom');
    expect(await authRepository.getRolesAndPermissions(1)).toMatchObject({
      permissionMode: 'custom',
      scopes: {},
    });
  });

  it('reads saved grants outside the role and preserves province selection', async () => {
    await usersRepository.replaceUserPermissionOverrides(
      1,
      [
        {
          code: 'cems_wpms_requests:approve',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          province: '21',
        },
      ],
      99,
    );
    expect(await authRepository.getRolesAndPermissions(1)).toMatchObject({
      permissionMode: 'custom',
      scopes: { 'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'ระยอง' } },
    });
    expect(await authRepository.getRolePermissions(1, 'factory_operator')).toMatchObject({
      roles: ['factory_operator'],
      permissionMode: 'custom',
      scopes: { 'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'ระยอง' } },
    });
  });

  it('resets rows and mode in one transaction and restores role defaults', async () => {
    await usersRepository.replaceUserPermissionOverrides(1, [], 99);
    await usersRepository.replaceUserPermissionOverrides(1, [], 99, 'role_default');
    expect(mode).toBe('role_default');
    expect(saved).toEqual([]);
    expect(await authRepository.getRolesAndPermissions(1)).toMatchObject({
      permissionMode: 'role_default',
      scopes: { 'dashboard:view': 'OWN_FACTORY' },
    });
  });

  it('rolls back the mode and old rows if saving an unknown permission fails', async () => {
    saved = [{ user_id: 1, permission_id: 1, effect: 'deny', scope: null }];
    await expect(
      usersRepository.replaceUserPermissionOverrides(
        1,
        [{ code: 'does_not_exist:view', effect: 'allow', scope: 'ALL' }],
        99,
      ),
    ).rejects.toThrow('Permission not loaded');
    expect(mode).toBe('role_default');
    expect(saved).toEqual([{ user_id: 1, permission_id: 1, effect: 'deny', scope: null }]);
  });

  it('preserves a custom set during a role-only update and allows an explicit reset', async () => {
    mode = 'custom';
    saved = [{ user_id: 1, permission_id: 2, effect: 'allow', scope: 'ALL' }];
    jest
      .spyOn(usersRepository, 'findRolesByCodes')
      .mockResolvedValue([{ id: 2, code: 'new_role', name_th: 'บทบาทใหม่', name_en: 'New role' }]);
    jest
      .spyOn(usersRepository, 'findById')
      .mockImplementation(async () => ({ id: 1, permissionMode: mode }) as ManagedUserDetailDTO);
    await usersRepository.update(1, { roleCodes: ['new_role'] }, 99);
    expect(mode).toBe('custom');
    expect(saved).toEqual([{ user_id: 1, permission_id: 2, effect: 'allow', scope: 'ALL' }]);
    await usersRepository.update(1, { permissionMode: 'role_default' }, 99);
    expect(mode).toBe('role_default');
    expect(saved).toEqual([]);
  });

  it('uses role defaults for a new local account until a custom set is supplied, even empty', async () => {
    jest.spyOn(usersRepository, 'findRolesByCodes').mockResolvedValue([]);
    jest
      .spyOn(usersRepository, 'findById')
      .mockImplementation(async () => ({ id: 1, permissionMode: mode }) as ManagedUserDetailDTO);
    const input = {
      username: 'fixture_user',
      fullName: 'ผู้ทดสอบ',
      password: randomUUID(),
      passwordHash: 'fixture-only',
      userType: 'officer' as const,
      isActive: true,
      roleCodes: [],
    };
    await usersRepository.createLocalAccount(input, 99);
    expect(mode).toBe('role_default');
    await usersRepository.createLocalAccount({ ...input, permissionOverrides: [] }, 99);
    expect(mode).toBe('custom');
    expect(saved).toEqual([]);
  });
});
