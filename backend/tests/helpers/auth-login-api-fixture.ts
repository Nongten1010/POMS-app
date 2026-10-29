import type { Knex } from 'knex';
import { createKnexSqliteFixture } from './knex-sqlite-fixture';

export async function createAuthLoginApiFixture(
  db: Knex,
  externalId: string,
  passwordHash: string,
) {
  return createKnexSqliteFixture(
    db,
    {
      users: [
        {
          id: 1,
          identity_provider: 'local',
          external_id: externalId,
          username: externalId,
          user_type: 'operator',
          is_active: 1,
          deleted_at: null,
          password_hash: passwordHash,
          permission_mode: 'role_default',
          email: null,
          phone: null,
          prename_th: null,
          first_name: 'ผู้ใช้สมมติ',
          last_name: 'ทดสอบ',
        },
      ],
      roles: [
        { id: 1, code: 'factory_operator', deleted_at: null },
        { id: 2, code: 'public_user', deleted_at: null },
      ],
      permissions: [{ id: 1, code: 'dashboard:view' }],
      user_roles: [{ user_id: 1, role_id: 1, assigned_by: null }],
      role_permissions: [
        { role_id: 1, permission_id: 1, scope: 'OWN_FACTORY' },
        { role_id: 2, permission_id: 1, scope: 'ALL' },
      ],
      provinces: [{ id: '1000', name_th: 'กรุงเทพมหานคร' }],
    },
    {
      users: ['last_login_at', 'last_synced_at', 'updated_at'],
      user_permissions: [
        'user_id',
        'permission_id',
        'scope',
        'effect',
        'region_name',
        'province_id',
        'estate_code',
      ],
      operator_profiles: ['user_id', 'user_code', 'regis_date', 'synced_at'],
      juristics: ['id', 'juristic_id', 'name_th', 'name_en', 'deleted_at', 'updated_at'],
      factories: [
        'id',
        'fid',
        'code',
        'name',
        'juristic_id',
        'province_id',
        'system_id',
        'verify_status',
        'authorize_start',
        'authorize_end',
        'juristic_start',
        'verify_date',
        'is_active',
        'deleted_at',
        'updated_at',
      ],
      user_juristics: ['user_id', 'juristic_id', 'revoked_at'],
      user_factory_access: ['user_id', 'factory_id', 'revoked_at'],
    },
  );
}
