import { db } from '../../config/database';
import type { Knex } from 'knex';

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
  ministry_id: string | null;
  province_id: string | null;
  per_status: string | null;
  per_status_name: string | null;
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
    return db<UserRow>('users')
      .where({ username })
      .whereNull('deleted_at')
      .first();
  },

  getOfficerProfile(userId: number): Promise<OfficerProfileRow | undefined> {
    return db<OfficerProfileRow>('officer_profiles').where({ user_id: userId }).first();
  },

  getOperatorProfile(userId: number): Promise<OperatorProfileRow | undefined> {
    return db<OperatorProfileRow>('operator_profiles').where({ user_id: userId }).first();
  },

  async getRolesAndPermissions(
    userId: number,
  ): Promise<{
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

    // ถ้า user มี permission เดียวกันแต่หลาย scope จาก หลาย role → เอา scope กว้างที่สุด
    // priority: ALL > IN_PROVINCE > IN_ESTATE > OWN_FACTORY > null
    const priority: Record<string, number> = {
      ALL: 4,
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

    return {
      roles: roles.map((r) => r.code),
      scopes,
    };
  },

  async getOperatorFactories(
    userId: number,
  ): Promise<
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
