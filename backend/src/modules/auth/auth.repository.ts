import { db } from '../../config/database';
import type { Knex } from 'knex';
import type {
  ExternalOfficerProfile,
  ExternalOperatorProfile,
} from './identity-provider/identity-provider.interface';

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
  organize_id: string | null;
  division_id: string | null;
  department_id: string | null;
  department_name_th: string | null;
  ministry_id: string | null;
  province_id: string | null;
  per_status: string | null;
  per_status_name: string | null;
  regional_access_json?: string | null;
}

export interface OperatorProfileRow {
  user_id: number;
  user_code: string | null;
  regis_date: string | null;
}

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

  findUserByUsername(username: string): Promise<UserRow | undefined> {
    return db<UserRow>('users').where({ username }).whereNull('deleted_at').first();
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
      .where({ user_id: userId })
      .first(
        'officer_profiles.*',
        db.raw(
          'COALESCE(officer_profiles.department_name_th, department_org.name_th) as department_name_th',
        ),
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
      const provider = profile.identity_provider ?? 'officer_dpis';
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
      await assignUserRole(trx, userId, roleCode);

      const user = await trx<UserRow>('users')
        .where({ id: userId })
        .whereNull('deleted_at')
        .first();
      if (!user) throw new Error('Synced officer user could not be loaded');
      return user;
    });
  },

  async syncExternalOfficerProfile(userId: number, profile: ExternalOfficerProfile): Promise<void> {
    await syncExternalOfficerProfileWithTrx(db, userId, profile);
  },

  async syncExternalOperatorProfile(
    userId: number,
    profile: ExternalOperatorProfile,
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const existingProfile = await trx('operator_profiles').where({ user_id: userId }).first();
      const operatorProfilePayload = {
        user_code: profile.user_code,
        regis_date: profile.regis_date,
        synced_at: trx.raw('SYSDATETIME()'),
      };

      if (existingProfile) {
        await trx('operator_profiles').where({ user_id: userId }).update(operatorProfilePayload);
      } else {
        await trx('operator_profiles').insert({
          user_id: userId,
          ...operatorProfilePayload,
        });
      }

      for (const juristic of profile.juristics) {
        const juristicId = await upsertExternalJuristic(trx, juristic);
        await upsertUserJuristicAccess(trx, userId, juristicId);

        for (const factory of juristic.factories) {
          await upsertExternalFactory(trx, juristicId, factory);
        }
      }
    });
  },

  async getRolesAndPermissions(userId: number): Promise<{
    roles: string[];
    scopes: Record<string, string | null>;
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

    const userPerms: Array<{ code: string; scope: string | null; effect: 'allow' | 'deny' }> =
      await db('user_permissions')
        .join('permissions', 'user_permissions.permission_id', 'permissions.id')
        .where('user_permissions.user_id', userId)
        .select(
          'permissions.code as code',
          'user_permissions.scope as scope',
          'user_permissions.effect as effect',
        );

    // ถ้า user มี permission เดียวกันแต่หลาย scope จาก หลาย role → เอา scope กว้างที่สุด
    // priority: ALL > IN_PROVINCE > IN_ESTATE > OWN_FACTORY > null
    const priority: Record<string, number> = {
      ALL: 4,
      IN_REGION: 3,
      IN_PROVINCE: 3,
      IN_ESTATE: 2,
      OWN_FACTORY: 1,
    };
    const scopes: Record<string, string | null> = {};
    for (const p of perms) {
      const current = scopes[p.code];
      const currentRank = current === undefined ? -1 : (priority[current ?? 'NULL'] ?? 0);
      const newRank = priority[p.scope ?? 'NULL'] ?? 0;
      if (newRank >= currentRank) scopes[p.code] = p.scope;
    }

    // user_permissions เป็น per-user override:
    // deny = ตัดสิทธิ์นี้ออกจาก effective permissions
    // allow = set scope ตาม override โดยตรง แม้ role จะมี scope อื่นอยู่
    for (const p of userPerms) {
      if (p.effect === 'deny') {
        delete scopes[p.code];
        continue;
      }
      scopes[p.code] = p.scope;
    }

    return {
      roles: roles.map((r) => r.code),
      scopes,
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
    return db('user_juristics')
      .join('juristics', 'user_juristics.juristic_id', 'juristics.id')
      .join('factories', 'factories.juristic_id', 'juristics.id')
      .where('user_juristics.user_id', userId)
      .whereNull('factories.deleted_at')
      .whereNull('juristics.deleted_at')
      .whereNull('user_juristics.revoked_at')
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
  },

  updateLastLogin(userId: number, trx?: Knex.Transaction): Promise<number> {
    const q = (trx ?? db)('users')
      .where({ id: userId })
      .update({ last_login_at: db.raw('SYSDATETIME()') });
    return q;
  },
};

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
    organize_id: profile.organize_id,
    division_id: profile.division_id,
    department_id: profile.department_id,
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

async function assignUserRole(
  trx: Knex.Transaction,
  userId: number,
  roleCode: string,
): Promise<void> {
  const role = await trx('roles').where({ code: roleCode }).whereNull('deleted_at').first('id');
  if (!role) throw new Error(`Role ${roleCode} is not provisioned`);

  const existing = await trx('user_roles')
    .where({ user_id: userId, role_id: role.id })
    .first('user_id');
  if (!existing) {
    await trx('user_roles').insert({ user_id: userId, role_id: role.id });
  }
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

  await trx('juristics').insert({
    juristic_id: juristic.juristic_id,
    ...payload,
  });
  const inserted = await trx('juristics').where({ juristic_id: juristic.juristic_id }).first('id');
  if (!inserted) throw new Error('Synced juristic could not be loaded');

  return Number(inserted.id);
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

  await trx('user_juristics').insert({ user_id: userId, juristic_id: juristicId });
}

export function shouldInsertUserJuristicAccess(existing: unknown): boolean {
  return !existing;
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

  await trx('factories').insert({
    fid: factory.fid,
    ...payload,
  });
}
