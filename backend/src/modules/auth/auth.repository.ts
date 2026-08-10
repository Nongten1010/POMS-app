import { db } from '../../config/database';
import { applyPersonaPermissionOverrides, mergePermissionScopesWithOverrides } from './permissions';
import type {
  PermissionDataScope,
  PermissionScopeDetails,
  PersonaPermissionOverride,
} from './permissions';
import type { Knex } from 'knex';
import type {
  ExternalOfficerProfile,
  ExternalOperatorProfile,
} from './identity-provider/identity-provider.interface';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { grantTargetOperatorFactoryAccess } from '../../db/migrations/0073_grant_operator_demo_factory_access';
export interface UserRow {
  id: number;
  external_id: string;
  identity_provider: string;
  user_type: 'citizen' | 'operator' | 'officer' | 'admin';
  username: string | null;
  email: string | null;
  phone: string | null;
  prename_th: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
  password_hash: Buffer | null;
  deleted_at?: string | Date | null;
}

export interface OfficerProfileRow {
  user_id: number;
  pos_no: string | null;
  pertype_id: string | null;
  pertype: string | null;
  position_type_id: string | null;
  position_type_th: string | null;
  line_id: string | null;
  line_name_th: string | null;
  level_id: string | null;
  level_name_th: string | null;
  mposition_id?: string | null;
  mposition?: string | null;
  organize_id: string | null;
  organize_name_th?: string | null;
  division_name_th?: string | null;
  department_id: string | null;
  department_name_th: string | null;
  ministry_id: string | null;
  province_id: string | null;
  province_name_th?: string | null;
  estate_code?: string | null;
  per_status: string | null;
  per_status_name: string | null;
  regional_access_json?: string | null;
}

export interface OperatorProfileRow {
  user_id: number;
  user_code: string | null;
  regis_date: string | null;
}

const MANUAL_OPERATOR_FACTORY_ACCESS: Readonly<Record<string, readonly string[]>> = {
  '3191000135709': ['10120000325542'],
};

export const authRepository = {
  findUserByProviderAndExternalId(
    provider: string,
    externalId: string,
  ): Promise<UserRow | undefined> {
    return db<UserRow>('users')
      .where({ identity_provider: provider, external_id: externalId })
      .whereNull('deleted_at')
      .first();
  },

  findUserById(userId: number): Promise<UserRow | undefined> {
    return db<UserRow>('users').where({ id: userId }).whereNull('deleted_at').first();
  },

  getOfficerProfile(userId: number): Promise<OfficerProfileRow | undefined> {
    return db<OfficerProfileRow>('officer_profiles')
      .leftJoin('organizations as department_org', function joinDepartmentOrg() {
        this.on('department_org.external_id', '=', 'officer_profiles.department_id').andOnVal(
          'department_org.level',
          '=',
          'department',
        );
      })
      .leftJoin('provinces', 'provinces.id', 'officer_profiles.province_id')
      .where({ user_id: userId })
      .first(
        'officer_profiles.user_id',
        'officer_profiles.pos_no',
        'officer_profiles.pertype_id',
        'officer_profiles.pertype',
        'officer_profiles.position_type_id',
        'officer_profiles.position_type_th',
        'officer_profiles.line_id',
        'officer_profiles.line_name_th',
        'officer_profiles.level_id',
        'officer_profiles.level_name_th',
        'officer_profiles.mposition_id',
        'officer_profiles.mposition',
        'officer_profiles.organize_id',
        'officer_profiles.organize_name_th',
        'officer_profiles.division_name_th',
        'officer_profiles.department_id',
        db.raw(
          'COALESCE(officer_profiles.department_name_th, department_org.name_th) as department_name_th',
        ),
        'officer_profiles.ministry_id',
        'officer_profiles.province_id',
        'provinces.name_th as province_name_th',
        'officer_profiles.estate_code',
        'officer_profiles.per_status',
        'officer_profiles.per_status_name',
        'officer_profiles.regional_access_json',
      );
  },

  getOperatorProfile(userId: number): Promise<OperatorProfileRow | undefined> {
    return db<OperatorProfileRow>('operator_profiles').where({ user_id: userId }).first();
  },

  async upsertExternalOfficerUser(
    profile: ExternalOfficerProfile,
    roleCode: string,
  ): Promise<UserRow> {
    return db.transaction(async (trx) => {
      const provider = profile.identity_provider;
      if (!provider || provider === 'mock') {
        throw new Error('External officer profile is missing an API identity provider');
      }
      const existingUser = await trx<UserRow>('users')
        .where({ identity_provider: provider, external_id: profile.external_id })
        .whereNull('deleted_at')
        .first();
      const userPayload = {
        user_type: 'officer',
        username: profile.external_id,
        email: profile.email,
        phone: profile.phone,
        prename_th: profile.prename_th,
        first_name: profile.first_name,
        last_name: profile.last_name,
        is_active: true,
        last_synced_at: trx.raw('SYSDATETIME()'),
        updated_at: trx.raw('SYSDATETIME()'),
      };

      let userId: number;
      if (existingUser) {
        await trx('users').where({ id: existingUser.id }).update(userPayload);
        userId = Number(existingUser.id);
      } else {
        await trx('users').insert({
          external_id: profile.external_id,
          identity_provider: provider,
          ...userPayload,
        });
        const insertedUser = await trx<UserRow>('users')
          .where({ identity_provider: provider, external_id: profile.external_id })
          .whereNull('deleted_at')
          .first();
        if (!insertedUser) throw new Error('Synced officer user could not be loaded');
        userId = Number(insertedUser.id);
      }

      await syncExternalOfficerProfileWithTrx(trx, userId, profile);
      await syncIdentityProviderBaseRole(trx, userId, roleCode);

      const user = await trx<UserRow>('users')
        .where({ id: userId })
        .whereNull('deleted_at')
        .first();
      if (!user) throw new Error('Synced officer user could not be loaded');
      return user;
    });
  },

  async upsertExternalOperatorUser(
    profile: ExternalOperatorProfile,
    roleCode: string,
  ): Promise<UserRow | undefined> {
    return db.transaction(async (trx) => {
      const provider = profile.identity_provider;
      if (!provider || provider === 'mock') {
        throw new Error('External operator profile is missing an API identity provider');
      }

      const existingUser = await trx<UserRow>('users')
        .where({ identity_provider: provider, external_id: profile.external_id })
        .first();
      if (existingUser?.deleted_at) {
        return undefined;
      }
      if (
        existingUser &&
        existingUser.user_type !== 'operator' &&
        existingUser.user_type !== 'citizen'
      ) {
        return undefined;
      }
      if (existingUser && !Boolean(existingUser.is_active)) {
        return existingUser;
      }
      const userPayload = {
        user_type: 'operator',
        username: profile.external_id,
        email: profile.email,
        phone: profile.phone,
        prename_th: null,
        first_name: profile.first_name,
        last_name: profile.last_name,
        last_synced_at: trx.raw('SYSDATETIME()'),
        updated_at: trx.raw('SYSDATETIME()'),
      };

      let userId: number;
      if (existingUser) {
        await trx('users').where({ id: existingUser.id }).update(userPayload);
        userId = Number(existingUser.id);
      } else {
        try {
          await trx('users').insert({
            external_id: profile.external_id,
            identity_provider: provider,
            ...userPayload,
            is_active: true,
          });
          const insertedUser = await trx<UserRow>('users')
            .where({ identity_provider: provider, external_id: profile.external_id })
            .first();
          if (!insertedUser) throw new Error('Synced operator user could not be loaded');
          userId = Number(insertedUser.id);
        } catch (error) {
          if (!isSqlServerUniqueKeyViolation(error)) throw error;

          const concurrentlyInsertedUser = await trx<UserRow>('users')
            .where({ identity_provider: provider, external_id: profile.external_id })
            .first();
          if (!concurrentlyInsertedUser) throw error;
          if (concurrentlyInsertedUser.deleted_at) return undefined;
          if (
            concurrentlyInsertedUser.user_type !== 'operator' &&
            concurrentlyInsertedUser.user_type !== 'citizen'
          ) {
            return undefined;
          }
          if (!Boolean(concurrentlyInsertedUser.is_active)) return concurrentlyInsertedUser;

          await trx('users').where({ id: concurrentlyInsertedUser.id }).update(userPayload);
          userId = Number(concurrentlyInsertedUser.id);
        }
      }

      await syncExternalOperatorProfileWithTrx(trx, userId, profile);
      await syncAssignedRole(trx, userId, roleCode);

      const user = await trx<UserRow>('users').where({ id: userId }).first();
      if (!user) throw new Error('Synced operator user could not be loaded');
      return user;
    });
  },

  async upsertExternalCitizenUser(profile: ExternalOperatorProfile): Promise<UserRow | undefined> {
    return db.transaction(async (trx) => {
      const provider = profile.identity_provider;
      if (!provider || provider === 'mock') {
        throw new Error('External citizen profile is missing an API identity provider');
      }

      const existingUser = await trx<UserRow>('users')
        .where({ identity_provider: provider, external_id: profile.external_id })
        .first();
      if (existingUser?.deleted_at) return undefined;
      if (
        existingUser &&
        existingUser.user_type !== 'citizen' &&
        existingUser.user_type !== 'operator'
      ) {
        return undefined;
      }
      if (existingUser && !Boolean(existingUser.is_active)) return existingUser;

      const userPayload = {
        username: profile.external_id,
        email: profile.email,
        phone: profile.phone,
        prename_th: null,
        first_name: profile.first_name,
        last_name: profile.last_name,
        last_synced_at: trx.raw('SYSDATETIME()'),
        updated_at: trx.raw('SYSDATETIME()'),
      };

      let userId: number;
      if (existingUser) {
        await trx('users').where({ id: existingUser.id }).update(userPayload);
        userId = Number(existingUser.id);
      } else {
        try {
          await trx('users').insert({
            external_id: profile.external_id,
            identity_provider: provider,
            user_type: 'citizen',
            ...userPayload,
            is_active: true,
          });
          const insertedUser = await trx<UserRow>('users')
            .where({ identity_provider: provider, external_id: profile.external_id })
            .first();
          if (!insertedUser) throw new Error('Synced citizen user could not be loaded');
          userId = Number(insertedUser.id);
        } catch (error) {
          if (!isSqlServerUniqueKeyViolation(error)) throw error;

          const concurrentlyInsertedUser = await trx<UserRow>('users')
            .where({ identity_provider: provider, external_id: profile.external_id })
            .first();
          if (!concurrentlyInsertedUser) throw error;
          if (concurrentlyInsertedUser.deleted_at) return undefined;
          if (
            concurrentlyInsertedUser.user_type !== 'citizen' &&
            concurrentlyInsertedUser.user_type !== 'operator'
          ) {
            return undefined;
          }
          if (!Boolean(concurrentlyInsertedUser.is_active)) return concurrentlyInsertedUser;

          await trx('users').where({ id: concurrentlyInsertedUser.id }).update(userPayload);
          userId = Number(concurrentlyInsertedUser.id);
        }
      }

      return trx<UserRow>('users').where({ id: userId }).first();
    });
  },

  async syncExternalOfficerProfile(userId: number, profile: ExternalOfficerProfile): Promise<void> {
    await syncExternalOfficerProfileWithTrx(db, userId, profile);
  },

  async syncExternalOperatorProfile(
    userId: number,
    profile: ExternalOperatorProfile,
  ): Promise<void> {
    await db.transaction(async (trx) => syncExternalOperatorProfileWithTrx(trx, userId, profile));
  },

  async getRolesAndPermissions(userId: number): Promise<{
    roles: string[];
    scopes: Record<string, string | null | PermissionScopeDetails>;
  }> {
    const roles: Array<{ code: string }> = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', userId)
      .whereNull('roles.deleted_at')
      .select('roles.code');

    const perms: Array<{ code: string; scope: string | null }> = await db('user_roles')
      .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('user_roles.user_id', userId)
      .select('permissions.code as code', 'role_permissions.scope as scope');

    const userPerms: Array<{
      code: string;
      scope: string | null;
      effect: 'allow' | 'deny';
      region_name: string | null;
      province_name: string | null;
      estate_code: string | null;
    }> = await db('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .leftJoin('provinces', 'provinces.id', 'user_permissions.province_id')
      .where('user_permissions.user_id', userId)
      .select(
        'permissions.code as code',
        'user_permissions.scope as scope',
        'user_permissions.effect as effect',
        'user_permissions.region_name as region_name',
        'provinces.name_th as province_name',
        'user_permissions.estate_code as estate_code',
      );

    return {
      roles: roles.map((r) => r.code),
      scopes: mergePermissionScopesWithOverrides(
        perms.map((permission) => ({
          code: permission.code,
          scope: permission.scope as PermissionDataScope,
        })),
        userPerms.map((override) => ({
          code: override.code,
          effect: override.effect,
          scope: override.scope as PermissionDataScope,
          region: override.region_name,
          province: override.province_name,
          estate: override.estate_code,
        })),
      ),
    };
  },

  async getRolePermissions(
    userId: number,
    roleCode: string,
  ): Promise<{
    roles: string[];
    scopes: Record<string, string | null | PermissionScopeDetails>;
  }> {
    const role = await db('roles').where({ code: roleCode }).whereNull('deleted_at').first('id');
    if (!role) throw new Error(`Role ${roleCode} is not provisioned`);

    const permissions: Array<{ code: string; scope: PermissionDataScope }> = await db(
      'role_permissions',
    )
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('role_permissions.role_id', role.id)
      .select('permissions.code as code', 'role_permissions.scope as scope');

    const overrides: Array<{
      code: string;
      scope: PermissionDataScope;
      effect: PersonaPermissionOverride['effect'];
      region_name: string | null;
      province_name: string | null;
      estate_code: string | null;
    }> = await db('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .leftJoin('provinces', 'provinces.id', 'user_permissions.province_id')
      .where('user_permissions.user_id', userId)
      .select(
        'permissions.code as code',
        'user_permissions.scope as scope',
        'user_permissions.effect as effect',
        'user_permissions.region_name as region_name',
        'provinces.name_th as province_name',
        'user_permissions.estate_code as estate_code',
      );

    const roleScopes = Object.fromEntries(
      permissions.map((permission) => [permission.code, permission.scope]),
    );

    return {
      roles: [roleCode],
      scopes: applyPersonaPermissionOverrides(
        roleScopes,
        overrides.map((override) => ({
          code: override.code,
          effect: override.effect,
          scope: override.scope,
          region: override.region_name,
          province: override.province_name,
          estate: override.estate_code,
        })),
      ),
    };
  },

  async getOperatorFactories(userId: number): Promise<
    Array<{
      juristic_id: string;
      juristic_name_th: string;
      juristic_name_en: string | null;
      fid: string;
      code: string;
      name: string;
      province_id: string;
      system_id: number | null;
      verify_status: number;
      authorize_start: string | null;
      authorize_end: string | null;
    }>
  > {
    return buildOperatorFactoriesQuery(userId);
  },

  updateLastLogin(userId: number, trx?: Knex.Transaction): Promise<number> {
    const q = (trx ?? db)('users')
      .where({ id: userId })
      .update({ last_login_at: db.raw('SYSDATETIME()') });
    return q;
  },
};

function buildOperatorFactoriesQuery(userId: number) {
  return db('factories')
    .join('juristics', 'factories.juristic_id', 'juristics.id')
    .whereNull('factories.deleted_at')
    .whereNull('juristics.deleted_at')
    .modify((builder) => applyAssignedFactoryAccessFilter(builder, userId, 'factories'))
    .select(
      'juristics.juristic_id as juristic_id',
      'juristics.name_th as juristic_name_th',
      'juristics.name_en as juristic_name_en',
      'factories.fid as fid',
      'factories.code as code',
      'factories.name as name',
      'factories.province_id as province_id',
      'factories.system_id as system_id',
      'factories.verify_status as verify_status',
      'factories.authorize_start as authorize_start',
      'factories.authorize_end as authorize_end',
    );
}

export function buildOperatorFactoriesQueryForTests(userId: number) {
  return buildOperatorFactoriesQuery(userId);
}

type ExternalOperatorJuristic = ExternalOperatorProfile['juristics'][number];
type ExternalOperatorFactory = ExternalOperatorJuristic['factories'][number];

async function syncExternalOfficerProfileWithTrx(
  trx: Knex.Transaction | typeof db,
  userId: number,
  profile: ExternalOfficerProfile,
): Promise<void> {
  const existingProfile = await trx('officer_profiles').where({ user_id: userId }).first();
  const officerProfilePayload = {
    pos_no: profile.pos_no,
    pertype_id: profile.pertype_id,
    pertype: profile.pertype,
    position_type_id: profile.position_type_id,
    position_type_th: profile.position_type_th,
    line_id: profile.line_id,
    line_name_th: profile.line_name_th,
    level_id: profile.level_id,
    level_name_th: profile.level_name_th,
    mposition_id: profile.mposition_id ?? null,
    mposition: profile.mposition ?? null,
    organize_id: profile.organize_id || null,
    organize_name_th: profile.organize_name_th ?? null,
    division_name_th: profile.division_name_th ?? null,
    department_id: profile.department_id || null,
    department_name_th: profile.department_name_th ?? null,
    ministry_id: profile.ministry_id,
    province_id: profile.province_id,
    per_status: profile.per_status,
    per_status_name: profile.per_status_name,
    relocation_type: profile.relocation_type ?? null,
    relocation_name: profile.relocation_name ?? null,
    synced_at: trx.raw('SYSDATETIME()'),
  };

  if (existingProfile) {
    await trx('officer_profiles').where({ user_id: userId }).update(officerProfilePayload);
    return;
  }

  await trx('officer_profiles').insert({
    user_id: userId,
    ...officerProfilePayload,
  });
}

const IDENTITY_PROVIDER_BASE_ROLE_CODES = [
  'diw_central',
  'provincial_office',
  'industrial_estate',
] as const;

export async function syncIdentityProviderBaseRole(
  trx: Knex.Transaction,
  userId: number,
  roleCode: string,
): Promise<void> {
  const role = await trx('roles').where({ code: roleCode }).whereNull('deleted_at').first('id');
  if (!role) throw new Error(`Role ${roleCode} is not provisioned`);

  const identityRoleRows: Array<{ id: number }> = await trx('roles')
    .whereIn('code', [...IDENTITY_PROVIDER_BASE_ROLE_CODES])
    .whereNull('deleted_at')
    .select('id');
  const identityRoleIds = identityRoleRows.map((item) => item.id);

  const specializedRoles: Array<{ id: number; code: string }> = await trx(
    'user_roles as assigned_roles',
  )
    .join('roles as assigned_role', 'assigned_role.id', 'assigned_roles.role_id')
    .where('assigned_roles.user_id', userId)
    .whereNull('assigned_role.deleted_at')
    .whereNotIn('assigned_role.code', [...IDENTITY_PROVIDER_BASE_ROLE_CODES])
    .select('assigned_role.id', 'assigned_role.code');

  if (specializedRoles.length > 1) {
    throw new Error('Exactly one specialized officer role is required');
  }

  if (identityRoleIds.length > 0) {
    await trx('user_roles').where({ user_id: userId }).whereIn('role_id', identityRoleIds).del();
  }

  if (specializedRoles.length === 1) return;

  const existing = await trx('user_roles')
    .where({ user_id: userId, role_id: role.id })
    .first('user_id');
  if (!existing) {
    await trx('user_roles').insert({ user_id: userId, role_id: role.id, assigned_by: null });
  }
}

async function syncAssignedRole(
  trx: Knex.Transaction,
  userId: number,
  roleCode: string,
): Promise<void> {
  const role = await trx('roles').where({ code: roleCode }).whereNull('deleted_at').first('id');
  if (!role) throw new Error(`Role ${roleCode} is not provisioned`);

  const existing = await trx('user_roles')
    .where({ user_id: userId, role_id: role.id })
    .first('user_id');
  if (existing) return;

  try {
    await trx('user_roles').insert({ user_id: userId, role_id: role.id, assigned_by: null });
  } catch (error) {
    if (!isSqlServerUniqueKeyViolation(error)) throw error;
  }
}

function isSqlServerUniqueKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as {
    number?: unknown;
    originalError?: { info?: { number?: unknown } };
  };
  const errorNumber = candidate.number ?? candidate.originalError?.info?.number;
  return errorNumber === 2601 || errorNumber === 2627;
}

async function upsertExternalJuristic(
  trx: Knex.Transaction,
  juristic: ExternalOperatorJuristic,
): Promise<number> {
  const existing = await trx('juristics').where({ juristic_id: juristic.juristic_id }).first('id');
  const payload = {
    name_th: juristic.name_th,
    name_en: juristic.name_en,
    deleted_at: null,
    updated_at: trx.raw('SYSDATETIME()'),
  };

  if (existing) {
    await trx('juristics').where({ id: existing.id }).update(payload);
    return Number(existing.id);
  }

  try {
    await trx('juristics').insert({
      juristic_id: juristic.juristic_id,
      ...payload,
    });
  } catch (error) {
    if (!isSqlServerUniqueKeyViolation(error)) throw error;

    const concurrentlyInserted = await trx('juristics')
      .where({ juristic_id: juristic.juristic_id })
      .first('id');
    if (!concurrentlyInserted) throw error;
    await trx('juristics').where({ id: concurrentlyInserted.id }).update(payload);
    return Number(concurrentlyInserted.id);
  }

  const inserted = await trx('juristics').where({ juristic_id: juristic.juristic_id }).first('id');
  if (!inserted) throw new Error('Synced juristic could not be loaded');
  return Number(inserted.id);
}

async function syncExternalOperatorProfileWithTrx(
  trx: Knex.Transaction,
  userId: number,
  profile: ExternalOperatorProfile,
): Promise<void> {
  const existingProfile = await trx('operator_profiles').where({ user_id: userId }).first();
  const operatorProfilePayload = {
    user_code: profile.user_code,
    regis_date: profile.regis_date,
    synced_at: trx.raw('SYSDATETIME()'),
  };

  if (existingProfile) {
    await trx('operator_profiles').where({ user_id: userId }).update(operatorProfilePayload);
  } else {
    try {
      await trx('operator_profiles').insert({
        user_id: userId,
        ...operatorProfilePayload,
      });
    } catch (error) {
      if (!isSqlServerUniqueKeyViolation(error)) throw error;
      await trx('operator_profiles').where({ user_id: userId }).update(operatorProfilePayload);
    }
  }

  for (const juristic of profile.juristics) {
    const juristicId = await upsertExternalJuristic(trx, juristic);
    await upsertUserJuristicAccess(trx, userId, juristicId);

    for (const factory of juristic.factories) {
      await upsertExternalFactory(trx, juristicId, factory);
    }
  }

  await syncManualOperatorFactoryAccess(trx, userId, profile.citizen_id);
}

async function upsertUserJuristicAccess(
  trx: Knex.Transaction,
  userId: number,
  juristicId: number,
): Promise<void> {
  const existing = await trx('user_juristics')
    .where({ user_id: userId, juristic_id: juristicId })
    .first('user_id');

  if (!shouldInsertUserJuristicAccess(existing)) {
    return;
  }

  try {
    await trx('user_juristics').insert({ user_id: userId, juristic_id: juristicId });
  } catch (error) {
    if (!isSqlServerUniqueKeyViolation(error)) throw error;
  }
}

export function shouldInsertUserJuristicAccess(existing: unknown): boolean {
  return !existing;
}

export async function syncManualOperatorFactoryAccess(
  trx: Knex.Transaction,
  userId: number,
  operatorExternalId: string,
): Promise<void> {
  const factoryFids = MANUAL_OPERATOR_FACTORY_ACCESS[operatorExternalId] ?? [];
  for (const fid of factoryFids) {
    const factory = await trx('factories').where({ fid }).whereNull('deleted_at').first('id');
    if (!factory) {
      await grantTargetOperatorFactoryAccess(trx, userId);
      continue;
    }

    const existing = await trx('user_factory_access')
      .where({ user_id: userId, factory_id: factory.id })
      .first('revoked_at');
    if (existing) continue;

    try {
      await trx('user_factory_access').insert({ user_id: userId, factory_id: factory.id });
    } catch (error) {
      if (!isSqlServerUniqueKeyViolation(error)) throw error;
    }
  }
}

async function upsertExternalFactory(
  trx: Knex.Transaction,
  juristicId: number,
  factory: ExternalOperatorFactory,
): Promise<void> {
  const existing = await trx('factories').where({ fid: factory.fid }).first('id');
  const payload = {
    code: factory.code,
    name: factory.name,
    juristic_id: juristicId,
    province_id: factory.province_id,
    system_id: factory.system_id,
    verify_status: factory.verify_status,
    authorize_start: factory.authorize_start,
    authorize_end: factory.authorize_end,
    juristic_start: factory.juristic_start,
    verify_date: factory.verify_date,
    is_active: true,
    deleted_at: null,
    updated_at: trx.raw('SYSDATETIME()'),
  };

  if (existing) {
    await trx('factories').where({ id: existing.id }).update(payload);
    return;
  }

  try {
    await trx('factories').insert({
      fid: factory.fid,
      ...payload,
    });
  } catch (error) {
    if (!isSqlServerUniqueKeyViolation(error)) throw error;

    const concurrentlyInserted = await trx('factories').where({ fid: factory.fid }).first('id');
    if (!concurrentlyInserted) throw error;
    await trx('factories').where({ id: concurrentlyInserted.id }).update(payload);
  }
}
