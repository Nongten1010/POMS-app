import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  shouldInsertUserJuristicAccess,
  syncIdentityProviderBaseRole,
} from '../../src/modules/auth/auth.repository';

describe('authRepository operator juristic sync', () => {
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
  };
  builder.where.mockReturnValue(builder);
  builder.whereIn.mockReturnValue(builder);
  builder.whereNull.mockReturnValue(builder);
  for (const [method, implementation] of Object.entries(terminalMethods)) {
    builder[method as keyof typeof builder].mockImplementation(implementation);
  }
  return builder;
}
