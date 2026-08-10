import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockGrantTargetOperatorFactoryAccess = jest.fn();
jest.mock('../../src/db/migrations/0073_grant_operator_demo_factory_access', () => ({
  grantTargetOperatorFactoryAccess: mockGrantTargetOperatorFactoryAccess,
}));

import {
  authRepository,
  buildOperatorFactoriesQueryForTests,
  shouldInsertUserJuristicAccess,
  syncManualOperatorFactoryAccess,
  syncIdentityProviderBaseRole,
} from '../../src/modules/auth/auth.repository';
import { applyPersonaPermissionOverrides } from '../../src/modules/auth/permissions';
import { db } from '../../src/config/database';

const originalDbTransaction = db.transaction;

describe('persona permission isolation', () => {
  it('honors user denies without importing permissions from another persona', () => {
    const basePermissions = {
      'dashboard:view': 'OWN_FACTORY',
      'factories:view': 'OWN_FACTORY',
      'cems_wpms_requests:view': 'OWN_FACTORY',
    } as const;

    const result = applyPersonaPermissionOverrides(basePermissions, [
      {
        code: 'factories:view',
        effect: 'deny',
        scope: null,
        region: null,
        province: null,
      },
      {
        code: 'chat:answer',
        effect: 'allow',
        scope: null,
        region: null,
        province: null,
      },
    ]);

    expect(result).toEqual({
      'dashboard:view': 'OWN_FACTORY',
      'cems_wpms_requests:view': 'OWN_FACTORY',
    });
    expect(basePermissions).toHaveProperty('factories:view', 'OWN_FACTORY');
  });

  it('accepts a narrower user scope but never widens the selected persona role', () => {
    const result = applyPersonaPermissionOverrides(
      {
        'dashboard:view': 'ALL',
        'factories:view': 'OWN_FACTORY',
      },
      [
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: null,
          province: 'ระยอง',
        },
        {
          code: 'factories:view',
          effect: 'allow',
          scope: 'ALL',
          region: null,
          province: null,
        },
      ],
    );

    expect(result).toEqual({
      'dashboard:view': {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ระยอง',
      },
      'factories:view': 'OWN_FACTORY',
    });
  });
});

describe('authRepository operator juristic sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(db, 'transaction', {
      value: originalDbTransaction,
      configurable: true,
    });
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

  it('accepts a concurrently inserted direct factory grant', async () => {
    const factoryBuilder = chainableBuilder({ first: async () => ({ id: 501 }) });
    const accessBuilder = chainableBuilder({ first: async () => undefined });
    const insertBuilder = chainableBuilder({
      insert: async () => {
        throw Object.assign(new Error('duplicate direct grant'), { number: 2627 });
      },
    });
    const builders = [factoryBuilder, accessBuilder, insertBuilder];
    const trx = jest.fn((table: string) => {
      if (table === 'factories' || table === 'user_factory_access') return builders.shift();
      throw new Error(`Unexpected table ${table}`);
    }) as unknown as Knex.Transaction;

    await expect(
      syncManualOperatorFactoryAccess(trx, 88, '3191000135709'),
    ).resolves.toBeUndefined();
    expect(insertBuilder.insert).toHaveBeenCalled();
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

describe('authRepository i-Industry shared identity provisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(db, 'transaction', {
      value: originalDbTransaction,
      configurable: true,
    });
  });

  it('creates the operator, profile, juristic access, factory, and factory_operator role in one transaction', async () => {
    const profile = externalOperatorProfile();
    const user = externalOperatorUser();
    const existingUserLookup = chainableBuilder({ first: async () => undefined });
    const userInsert = chainableBuilder({ insert: async () => [1] });
    const insertedUserLookup = chainableBuilder({ first: async () => user });
    const finalUserLookup = chainableBuilder({ first: async () => user });
    const existingProfileLookup = chainableBuilder({ first: async () => undefined });
    const profileInsert = chainableBuilder({ insert: async () => [1] });
    const existingJuristicLookup = chainableBuilder({ first: async () => undefined });
    const juristicInsert = chainableBuilder({ insert: async () => [1] });
    const insertedJuristicLookup = chainableBuilder({ first: async () => ({ id: 501 }) });
    const existingAccessLookup = chainableBuilder({ first: async () => undefined });
    const accessInsert = chainableBuilder({ insert: async () => [1] });
    const existingFactoryLookup = chainableBuilder({ first: async () => undefined });
    const factoryInsert = chainableBuilder({ insert: async () => [1] });
    const roleLookup = chainableBuilder({ first: async () => ({ id: 7 }) });
    const existingRoleLookup = chainableBuilder({ first: async () => undefined });
    const roleInsert = chainableBuilder({ insert: async () => [1] });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userInsert, insertedUserLookup, finalUserLookup]],
      ['operator_profiles', [existingProfileLookup, profileInsert]],
      ['juristics', [existingJuristicLookup, juristicInsert, insertedJuristicLookup]],
      ['user_juristics', [existingAccessLookup, accessInsert]],
      ['factories', [existingFactoryLookup, factoryInsert]],
      ['roles', [roleLookup]],
      ['user_roles', [existingRoleLookup, roleInsert]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(profile, 'factory_operator');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(existingUserLookup.where).toHaveBeenCalledWith({
      identity_provider: 'i_industry',
      external_id: profile.external_id,
    });
    expect(existingUserLookup.whereNull).not.toHaveBeenCalled();
    expect(userInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        identity_provider: 'i_industry',
        external_id: profile.external_id,
        user_type: 'operator',
        username: profile.external_id,
        is_active: true,
      }),
    );
    expect(profileInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: user.id,
        user_code: profile.user_code,
        regis_date: profile.regis_date,
      }),
    );
    expect(juristicInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ juristic_id: profile.juristics[0].juristic_id }),
    );
    expect(accessInsert.insert).toHaveBeenCalledWith({ user_id: user.id, juristic_id: 501 });
    expect(factoryInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        fid: profile.juristics[0].factories[0].fid,
        juristic_id: 501,
      }),
    );
    expect(roleLookup.where).toHaveBeenCalledWith({ code: 'factory_operator' });
    expect(roleInsert.insert).toHaveBeenCalledWith({
      user_id: user.id,
      role_id: 7,
      assigned_by: null,
    });
    expect(result).toEqual(user);
  });

  it('promotes an existing i-Industry citizen identity when the same account gains operator ownership', async () => {
    const profile = { ...externalOperatorProfile(), juristics: [] };
    const existingCitizen = {
      ...externalOperatorUser(),
      user_type: 'citizen' as const,
    };
    const promotedOperator = externalOperatorUser();
    const existingUserLookup = chainableBuilder({ first: async () => existingCitizen });
    const userUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => promotedOperator });
    const existingProfileLookup = chainableBuilder({ first: async () => undefined });
    const profileInsert = chainableBuilder({ insert: async () => [1] });
    const roleLookup = chainableBuilder({ first: async () => ({ id: 7 }) });
    const existingRoleLookup = chainableBuilder({ first: async () => undefined });
    const roleInsert = chainableBuilder({ insert: async () => [1] });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userUpdate, finalUserLookup]],
      ['operator_profiles', [existingProfileLookup, profileInsert]],
      ['roles', [roleLookup]],
      ['user_roles', [existingRoleLookup, roleInsert]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(profile, 'factory_operator');

    expect(userUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_type: 'operator',
        username: profile.external_id,
      }),
    );
    expect(profileInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: promotedOperator.id }),
    );
    expect(roleInsert.insert).toHaveBeenCalled();
    expect(result).toEqual(promotedOperator);
  });

  it('reuses a concurrently inserted operator after a SQL Server unique-key race', async () => {
    const profile = { ...externalOperatorProfile(), juristics: [] };
    const user = externalOperatorUser();
    const duplicateKeyError = Object.assign(new Error('duplicate provider identity'), {
      number: 2627,
    });
    const initialUserLookup = chainableBuilder({ first: async () => undefined });
    const racingUserInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const concurrentUserLookup = chainableBuilder({ first: async () => user });
    const concurrentUserUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => user });
    const existingProfileLookup = chainableBuilder({ first: async () => undefined });
    const profileInsert = chainableBuilder({ insert: async () => [1] });
    const roleLookup = chainableBuilder({ first: async () => ({ id: 7 }) });
    const existingRoleLookup = chainableBuilder({ first: async () => undefined });
    const roleInsert = chainableBuilder({ insert: async () => [1] });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      [
        'users',
        [
          initialUserLookup,
          racingUserInsert,
          concurrentUserLookup,
          concurrentUserUpdate,
          finalUserLookup,
        ],
      ],
      ['operator_profiles', [existingProfileLookup, profileInsert]],
      ['roles', [roleLookup]],
      ['user_roles', [existingRoleLookup, roleInsert]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(profile, 'factory_operator');

    expect(racingUserInsert.insert).toHaveBeenCalledTimes(1);
    expect(concurrentUserLookup.where).toHaveBeenCalledWith({
      identity_provider: 'i_industry',
      external_id: profile.external_id,
    });
    expect(concurrentUserUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_type: 'operator',
        username: profile.external_id,
      }),
    );
    expect(profileInsert.insert).toHaveBeenCalled();
    expect(roleInsert.insert).toHaveBeenCalled();
    expect(result).toEqual(user);
  });

  it('reuses concurrently inserted profile, access, juristic, factory, and role rows', async () => {
    const profile = externalOperatorProfile();
    const user = externalOperatorUser();
    const duplicateKeyError = Object.assign(new Error('duplicate shared identity'), {
      originalError: { info: { number: 2601 } },
    });
    const existingUserLookup = chainableBuilder({ first: async () => user });
    const userUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => user });
    const existingProfileLookup = chainableBuilder({ first: async () => undefined });
    const racingProfileInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const concurrentProfileUpdate = chainableBuilder({ update: async () => 1 });
    const existingJuristicLookup = chainableBuilder({ first: async () => undefined });
    const racingJuristicInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const concurrentJuristicLookup = chainableBuilder({ first: async () => ({ id: 501 }) });
    const concurrentJuristicUpdate = chainableBuilder({ update: async () => 1 });
    const existingAccessLookup = chainableBuilder({ first: async () => undefined });
    const racingAccessInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const existingFactoryLookup = chainableBuilder({ first: async () => undefined });
    const racingFactoryInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const concurrentFactoryLookup = chainableBuilder({ first: async () => ({ id: 601 }) });
    const concurrentFactoryUpdate = chainableBuilder({ update: async () => 1 });
    const roleLookup = chainableBuilder({ first: async () => ({ id: 7 }) });
    const existingRoleLookup = chainableBuilder({ first: async () => undefined });
    const racingRoleInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userUpdate, finalUserLookup]],
      ['operator_profiles', [existingProfileLookup, racingProfileInsert, concurrentProfileUpdate]],
      [
        'juristics',
        [
          existingJuristicLookup,
          racingJuristicInsert,
          concurrentJuristicLookup,
          concurrentJuristicUpdate,
        ],
      ],
      ['user_juristics', [existingAccessLookup, racingAccessInsert]],
      [
        'factories',
        [
          existingFactoryLookup,
          racingFactoryInsert,
          concurrentFactoryLookup,
          concurrentFactoryUpdate,
        ],
      ],
      ['roles', [roleLookup]],
      ['user_roles', [existingRoleLookup, racingRoleInsert]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(profile, 'factory_operator');

    expect(concurrentProfileUpdate.update).toHaveBeenCalled();
    expect(concurrentJuristicUpdate.update).toHaveBeenCalled();
    expect(racingAccessInsert.insert).toHaveBeenCalled();
    expect(concurrentFactoryUpdate.update).toHaveBeenCalled();
    expect(racingRoleInsert.insert).toHaveBeenCalled();
    expect(result).toEqual(user);
  });

  it('updates an active repeat login without duplicating juristic access or role assignment', async () => {
    const profile = externalOperatorProfile();
    const user = externalOperatorUser();
    const existingUserLookup = chainableBuilder({ first: async () => user });
    const userUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => user });
    const existingProfileLookup = chainableBuilder({ first: async () => ({ user_id: 91 }) });
    const profileUpdate = chainableBuilder({ update: async () => 1 });
    const existingJuristicLookup = chainableBuilder({ first: async () => ({ id: 501 }) });
    const juristicUpdate = chainableBuilder({ update: async () => 1 });
    const existingAccessLookup = chainableBuilder({
      first: async () => ({ user_id: 91, revoked_at: null }),
    });
    const existingFactoryLookup = chainableBuilder({ first: async () => ({ id: 601 }) });
    const factoryUpdate = chainableBuilder({ update: async () => 1 });
    const roleLookup = chainableBuilder({ first: async () => ({ id: 7 }) });
    const existingRoleLookup = chainableBuilder({ first: async () => ({ user_id: 91 }) });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userUpdate, finalUserLookup]],
      ['operator_profiles', [existingProfileLookup, profileUpdate]],
      ['juristics', [existingJuristicLookup, juristicUpdate]],
      ['user_juristics', [existingAccessLookup]],
      ['factories', [existingFactoryLookup, factoryUpdate]],
      ['roles', [roleLookup]],
      ['user_roles', [existingRoleLookup]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(profile, 'factory_operator');

    const updatedUser = userUpdate.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatedUser).not.toHaveProperty('is_active');
    expect(profileUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_code: profile.user_code,
        regis_date: profile.regis_date,
      }),
    );
    expect(juristicUpdate.update).toHaveBeenCalled();
    expect(factoryUpdate.update).toHaveBeenCalled();
    expect(queues.get('user_juristics')).toHaveLength(0);
    expect(queues.get('user_roles')).toHaveLength(0);
    expect(result).toEqual(user);
  });

  it('returns an existing inactive operator without updating profiles, access, factories, or roles', async () => {
    const inactiveUser = { ...externalOperatorUser(), is_active: false };
    const existingUserLookup = chainableBuilder({ first: async () => inactiveUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup]],
    ]);
    const trx = mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(
      externalOperatorProfile(),
      'factory_operator',
    );

    expect(result).toEqual(inactiveUser);
    expect(trx).toHaveBeenCalledTimes(1);
    expect(trx).toHaveBeenCalledWith('users');
  });

  it('returns undefined without writes when the provider identity is soft-deleted', async () => {
    const deletedUser = {
      ...externalOperatorUser(),
      deleted_at: '2026-08-01T00:00:00.000Z',
    };
    const existingUserLookup = chainableBuilder({ first: async () => deletedUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup]],
    ]);
    const trx = mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(
      externalOperatorProfile(),
      'factory_operator',
    );

    expect(result).toBeUndefined();
    expect(existingUserLookup.whereNull).not.toHaveBeenCalled();
    expect(trx).toHaveBeenCalledTimes(1);
  });

  it('returns undefined without writes when the provider identity belongs to another user type', async () => {
    const collidingUser = {
      ...externalOperatorUser(),
      user_type: 'officer' as const,
    };
    const existingUserLookup = chainableBuilder({ first: async () => collidingUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup]],
    ]);
    const trx = mockNextTransaction(queues);

    const result = await authRepository.upsertExternalOperatorUser(
      externalOperatorProfile(),
      'factory_operator',
    );

    expect(result).toBeUndefined();
    expect(trx).toHaveBeenCalledTimes(1);
  });

  it('creates a citizen identity without creating operator artifacts', async () => {
    const profile = externalOperatorProfile();
    const citizenUser = { ...externalOperatorUser(), user_type: 'citizen' as const };
    const existingUserLookup = chainableBuilder({ first: async () => undefined });
    const userInsert = chainableBuilder({ insert: async () => [1] });
    const insertedUserLookup = chainableBuilder({ first: async () => citizenUser });
    const finalUserLookup = chainableBuilder({ first: async () => citizenUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userInsert, insertedUserLookup, finalUserLookup]],
    ]);
    const trx = mockNextTransaction(queues);

    const result = await authRepository.upsertExternalCitizenUser(profile);

    expect(userInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        identity_provider: 'i_industry',
        external_id: profile.external_id,
        user_type: 'citizen',
        is_active: true,
      }),
    );
    expect(trx).toHaveBeenCalledTimes(4);
    expect(result).toEqual(citizenUser);
  });

  it('reuses an existing operator identity for citizen sessions without downgrading it', async () => {
    const operatorUser = externalOperatorUser();
    const existingUserLookup = chainableBuilder({ first: async () => operatorUser });
    const userUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => operatorUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      ['users', [existingUserLookup, userUpdate, finalUserLookup]],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalCitizenUser(externalOperatorProfile());

    const payload = userUpdate.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('user_type');
    expect(payload).not.toHaveProperty('is_active');
    expect(result).toEqual(operatorUser);
  });

  it('reuses a concurrently inserted operator identity for a citizen session', async () => {
    const operatorUser = externalOperatorUser();
    const duplicateKeyError = Object.assign(new Error('duplicate provider identity'), {
      number: 2627,
    });
    const initialUserLookup = chainableBuilder({ first: async () => undefined });
    const racingInsert = chainableBuilder({
      insert: async () => {
        throw duplicateKeyError;
      },
    });
    const concurrentUserLookup = chainableBuilder({ first: async () => operatorUser });
    const concurrentUserUpdate = chainableBuilder({ update: async () => 1 });
    const finalUserLookup = chainableBuilder({ first: async () => operatorUser });
    const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
      [
        'users',
        [
          initialUserLookup,
          racingInsert,
          concurrentUserLookup,
          concurrentUserUpdate,
          finalUserLookup,
        ],
      ],
    ]);
    mockNextTransaction(queues);

    const result = await authRepository.upsertExternalCitizenUser(externalOperatorProfile());

    expect(racingInsert.insert).toHaveBeenCalledTimes(1);
    expect(concurrentUserUpdate.update).toHaveBeenCalled();
    expect(result).toEqual(operatorUser);
  });

  it.each([
    ['inactive', { ...externalOperatorUser(), is_active: false }, true],
    ['soft-deleted', { ...externalOperatorUser(), deleted_at: '2026-08-01T00:00:00.000Z' }, false],
    ['different user type', { ...externalOperatorUser(), user_type: 'officer' as const }, false],
  ])(
    'does not modify an %s identity during citizen login',
    async (_label, existing, returnsExisting) => {
      const existingUserLookup = chainableBuilder({ first: async () => existing });
      const queues = new Map<string, Array<ReturnType<typeof chainableBuilder>>>([
        ['users', [existingUserLookup]],
      ]);
      const trx = mockNextTransaction(queues);

      const result = await authRepository.upsertExternalCitizenUser(externalOperatorProfile());

      expect(trx).toHaveBeenCalledTimes(1);
      expect(result).toEqual(returnsExisting ? existing : undefined);
    },
  );
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

function mockNextTransaction(
  queues: Map<string, Array<ReturnType<typeof chainableBuilder>>>,
): Knex.Transaction {
  const trx = Object.assign(
    jest.fn((table: string) => {
      const builder = queues.get(table)?.shift();
      if (!builder) throw new Error(`Unexpected query for ${table}`);
      return builder;
    }),
    { raw: jest.fn(() => 'db-now') },
  ) as unknown as Knex.Transaction;

  Object.defineProperty(db, 'transaction', {
    value: jest.fn(async (callback: (transaction: Knex.Transaction) => Promise<unknown>) =>
      callback(trx),
    ),
    configurable: true,
  });
  return trx;
}

function externalOperatorProfile() {
  return {
    identity_provider: 'i_industry' as const,
    external_id: '1111111111111',
    // Deliberately distinct so repository identity lookups cannot accidentally key on citizen_id.
    citizen_id: '2222222222222',
    user_code: 'OP-001',
    first_name: 'ผู้ประกอบการ',
    last_name: 'ทดสอบ',
    email: 'operator@example.test',
    phone: null,
    regis_date: '2026-08-10',
    juristics: [
      {
        juristic_id: '0100000000001',
        name_th: 'บริษัท ทดสอบ จำกัด',
        name_en: 'TEST COMPANY LIMITED',
        factories: [
          {
            fid: '10100000000001',
            code: 'TEST-001',
            name: 'โรงงานทดสอบ',
            province_id: '1000',
            system_id: null,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
        ],
      },
    ],
  };
}

function externalOperatorUser() {
  return {
    id: 91,
    external_id: '1111111111111',
    identity_provider: 'i_industry',
    user_type: 'operator' as const,
    username: '1111111111111',
    email: 'operator@example.test',
    phone: null,
    prename_th: null,
    first_name: 'ผู้ประกอบการ',
    last_name: 'ทดสอบ',
    is_active: true,
    password_hash: null,
  };
}
