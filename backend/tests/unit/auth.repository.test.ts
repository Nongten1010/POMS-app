import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockGrantTargetOperatorFactoryAccess = jest.fn();
jest.mock('../../src/db/migrations/0073_grant_operator_demo_factory_access', () => ({
  grantTargetOperatorFactoryAccess: mockGrantTargetOperatorFactoryAccess,
}));

import {
  buildOperatorFactoriesQueryForTests,
  shouldInsertUserJuristicAccess,
  syncManualOperatorFactoryAccess,
  syncIdentityProviderBaseRole,
} from '../../src/modules/auth/auth.repository';

describe('authRepository operator juristic sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts juristic access only when no existing user_juristics row exists', () => {
    expect(shouldInsertUserJuristicAccess(undefined)).toBe(true);
    expect(shouldInsertUserJuristicAccess(null)).toBe(true);
  });

  it('keeps existing juristic access state so revoked rows are not restored on login', () => {
    expect(shouldInsertUserJuristicAccess({ user_id: 4, revoked_at: null })).toBe(false);
    expect(
      shouldInsertUserJuristicAccess({
        user_id: 4,
        revoked_at: '2026-06-25T21:15:53.124+07:00',
      }),
    ).toBe(false);
  });

  it('includes direct per-factory grants in the operator factory list', () => {
    const compiled = buildOperatorFactoriesQueryForTests(88).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('ufa.factory_id = factories.id');
    expect(sql).toContain('from [factories] inner join [juristics]');
    expect(compiled.bindings.filter((binding: unknown) => binding === 88)).toHaveLength(2);
  });

  it('creates the requested direct factory grant when the operator logs in later', async () => {
    const factoryBuilder = chainableBuilder({ first: async () => ({ id: 501 }) });
    const accessBuilder = chainableBuilder({ first: async () => undefined });
    const insertBuilder = chainableBuilder({ insert: async () => [1] });
    const builders = [factoryBuilder, accessBuilder, insertBuilder];
    const trx = jest.fn((table: string) => {
      if (table === 'factories' || table === 'user_factory_access') return builders.shift();
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as Knex.Transaction;
    Object.assign(trx, { raw: jest.fn(() => 'now') });

    await syncManualOperatorFactoryAccess(trx, 88, '3191000135709');

    expect(factoryBuilder.where).toHaveBeenCalledWith({ fid: '10120000325542' });
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 88,
      factory_id: 501,
    });
  });

  it('does not restore a direct factory grant that was explicitly revoked', async () => {
    const factoryBuilder = chainableBuilder({ first: async () => ({ id: 501 }) });
    const accessBuilder = chainableBuilder({
      first: async () => ({ revoked_at: '2026-07-01' }),
    });
    const builders = [factoryBuilder, accessBuilder];
    const trx = jest.fn((table: string) => {
      if (table === 'factories' || table === 'user_factory_access') return builders.shift();
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as Knex.Transaction;

    await syncManualOperatorFactoryAccess(trx, 88, '3191000135709');

    expect(builders).toHaveLength(0);
  });

  it('hydrates and grants the target factory when a production user logs in after migration', async () => {
    const factoryBuilder = chainableBuilder({ first: async () => undefined });
    const trx = jest.fn((table: string) => {
      if (table === 'factories') return factoryBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as Knex.Transaction;

    await syncManualOperatorFactoryAccess(trx, 88, '3191000135709');

    expect(mockGrantTargetOperatorFactoryAccess).toHaveBeenCalledWith(trx, 88);
  });
});

describe('authRepository officer base-role sync', () => {
  it('replaces every prior organization base role while preserving unrelated roles', async () => {
    const selectedRoleBuilder = chainableBuilder({ first: async () => ({ id: 6 }) });
    const baseRolesBuilder = chainableBuilder({
      select: async () => [{ id: 4 }, { id: 5 }, { id: 6 }],
    });
    const deleteBaseRolesBuilder = chainableBuilder({ del: async () => 2 });
    const existingRoleBuilder = chainableBuilder({ first: async () => undefined });
    const insertRoleBuilder = chainableBuilder({ insert: async () => [1] });
    const roleBuilders = [selectedRoleBuilder, baseRolesBuilder];
    const userRoleBuilders = [deleteBaseRolesBuilder, existingRoleBuilder, insertRoleBuilder];
    const trx = jest.fn((table: string) => {
      if (table === 'roles') return roleBuilders.shift();
      if (table === 'user_roles') return userRoleBuilders.shift();
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as Knex.Transaction;

    await syncIdentityProviderBaseRole(trx, 88, 'industrial_estate');

    expect(deleteBaseRolesBuilder.where).toHaveBeenCalledWith({ user_id: 88 });
    expect(deleteBaseRolesBuilder.whereIn).toHaveBeenCalledWith('role_id', [4, 5, 6]);
    expect(deleteBaseRolesBuilder.whereNull).not.toHaveBeenCalled();
    expect(insertRoleBuilder.insert).toHaveBeenCalledWith({
      user_id: 88,
      role_id: 6,
      assigned_by: null,
    });
  });
});

function chainableBuilder(terminalMethods: Record<string, (...args: unknown[]) => unknown>) {
  const builder = {
    where: jest.fn(),
    whereIn: jest.fn(),
    whereNull: jest.fn(),
    first: jest.fn(),
    select: jest.fn(),
    del: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  builder.where.mockReturnValue(builder);
  builder.whereIn.mockReturnValue(builder);
  builder.whereNull.mockReturnValue(builder);
  for (const [method, implementation] of Object.entries(terminalMethods)) {
    builder[method as keyof typeof builder].mockImplementation(implementation);
  }
  return builder;
}
