import type { Knex } from 'knex';
import {
  RBAC_MATRIX_V20260810_GRANTS,
  RBAC_MATRIX_V20260810_PERMISSIONS,
  RBAC_MATRIX_V20260810_ROLE_CODES,
  type RolePermissionScope,
} from '../seeds/rbac_matrix_v20260810';
import {
  RBAC_MATRIX_PRE20260810_GRANTS,
  RBAC_MATRIX_PRE20260810_ROLE_CODES,
} from '../seeds/rbac_matrix_pre20260810';

const NEW_PERMISSION_CODES = new Set([
  'statistics:view',
  'statistics:export',
  'conditional_search:view',
  'permissions:view',
  'eligible_factories:view',
  'eligible_factories:edit',
  'chat:view',
]);

export async function up(knex: Knex): Promise<void> {
  await ensureEstateCodeSchema(knex);

  for (const permission of RBAC_MATRIX_V20260810_PERMISSIONS.filter((item) =>
    NEW_PERMISSION_CODES.has(item.code),
  )) {
    const existing = await knex('permissions').where({ code: permission.code }).first('id');
    if (existing) {
      await knex('permissions').where({ id: existing.id }).update({
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      });
      continue;
    }

    await knex('permissions').insert(permission);
  }

  const systemRoleCodes = [...RBAC_MATRIX_V20260810_ROLE_CODES];
  const roleRows: Array<{ id: number; code: string }> = await knex('roles')
    .whereIn('code', systemRoleCodes)
    .whereNull('deleted_at')
    .select('id', 'code');
  const permissionRows: Array<{ id: number; code: string }> = await knex('permissions').select(
    'id',
    'code',
  );
  const roleByCode = new Map(roleRows.map((role) => [role.code, role.id]));
  const permissionByCode = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  if (roleRows.length > 0) {
    await knex('role_permissions')
      .whereIn(
        'role_id',
        roleRows.map((role) => role.id),
      )
      .del();
  }

  const grantRows = mapGrantRows(RBAC_MATRIX_V20260810_GRANTS, roleByCode, permissionByCode);

  if (grantRows.length > 0) {
    await knex('role_permissions').insert(grantRows);
  }
}

export async function ensureEstateCodeSchema(knex: Knex): Promise<void> {
  const hasEstateCode = await knex.schema.hasColumn('user_permissions', 'estate_code');
  if (!hasEstateCode) {
    await knex.schema.alterTable('user_permissions', (table) => {
      table.specificType('estate_code', 'VARCHAR(16) NULL');
    });
  }
  const hasOfficerEstateCode = await knex.schema.hasColumn('officer_profiles', 'estate_code');
  if (!hasOfficerEstateCode) {
    await knex.schema.alterTable('officer_profiles', (table) => {
      table.specificType('estate_code', 'VARCHAR(16) NULL');
    });
  }

  // Knex creates the original code uniqueness as a filtered SQL Server index.
  // Foreign keys cannot reference filtered unique indexes, so provide an
  // equivalent unfiltered unique index before adding the estate-code FKs.
  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ux_industrial_estates_code_for_fk'
        AND object_id = OBJECT_ID('industrial_estates')
    )
    CREATE UNIQUE INDEX ux_industrial_estates_code_for_fk
    ON industrial_estates(code);
  `);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'fk_user_permissions_estate_code'
    )
    ALTER TABLE user_permissions
    ADD CONSTRAINT fk_user_permissions_estate_code
    FOREIGN KEY (estate_code) REFERENCES industrial_estates(code);
  `);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_user_permissions_estate_code'
        AND object_id = OBJECT_ID('user_permissions')
    )
    CREATE INDEX ix_user_permissions_estate_code
    ON user_permissions(scope, estate_code);
  `);
  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'fk_officer_profiles_estate_code'
    )
    ALTER TABLE officer_profiles
    ADD CONSTRAINT fk_officer_profiles_estate_code
    FOREIGN KEY (estate_code) REFERENCES industrial_estates(code);
  `);
  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_officer_profiles_estate_code'
        AND object_id = OBJECT_ID('officer_profiles')
    )
    CREATE INDEX ix_officer_profiles_estate_code
    ON officer_profiles(estate_code);
  `);
}

export async function down(knex: Knex): Promise<void> {
  const systemRoleCodes = [...RBAC_MATRIX_PRE20260810_ROLE_CODES];
  const roleRows: Array<{ id: number; code: string }> = await knex('roles')
    .whereIn('code', systemRoleCodes)
    .whereNull('deleted_at')
    .select('id', 'code');
  const permissionRows: Array<{ id: number; code: string }> = await knex('permissions').select(
    'id',
    'code',
  );
  const roleByCode = new Map(roleRows.map((role) => [role.code, role.id]));
  const permissionByCode = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  if (roleRows.length > 0) {
    await knex('role_permissions')
      .whereIn(
        'role_id',
        roleRows.map((role) => role.id),
      )
      .del();
  }

  const restoredGrantRows = mapGrantRows(
    RBAC_MATRIX_PRE20260810_GRANTS,
    roleByCode,
    permissionByCode,
  );
  if (restoredGrantRows.length > 0) {
    await knex('role_permissions').insert(restoredGrantRows);
  }

  const newPermissionIds = await knex('permissions')
    .whereIn('code', [...NEW_PERMISSION_CODES])
    .select<{ id: number }[]>('id');
  const permissionIds = newPermissionIds.map((row) => row.id);

  if (permissionIds.length > 0) {
    await knex('role_permissions').whereIn('permission_id', permissionIds).del();
    await knex('user_permissions').whereIn('permission_id', permissionIds).del();
    await knex('permissions').whereIn('id', permissionIds).del();
  }

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_user_permissions_estate_code'
        AND object_id = OBJECT_ID('user_permissions')
    )
    DROP INDEX ix_user_permissions_estate_code ON user_permissions;
  `);
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_officer_profiles_estate_code'
        AND object_id = OBJECT_ID('officer_profiles')
    )
    DROP INDEX ix_officer_profiles_estate_code ON officer_profiles;
  `);

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'fk_user_permissions_estate_code'
    )
    ALTER TABLE user_permissions
    DROP CONSTRAINT fk_user_permissions_estate_code;
  `);
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'fk_officer_profiles_estate_code'
    )
    ALTER TABLE officer_profiles
    DROP CONSTRAINT fk_officer_profiles_estate_code;
  `);
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ux_industrial_estates_code_for_fk'
        AND object_id = OBJECT_ID('industrial_estates')
    )
    DROP INDEX ux_industrial_estates_code_for_fk ON industrial_estates;
  `);

  const hasEstateCode = await knex.schema.hasColumn('user_permissions', 'estate_code');
  if (hasEstateCode) {
    await knex.schema.alterTable('user_permissions', (table) => {
      table.dropColumn('estate_code');
    });
  }
  const hasOfficerEstateCode = await knex.schema.hasColumn('officer_profiles', 'estate_code');
  if (hasOfficerEstateCode) {
    await knex.schema.alterTable('officer_profiles', (table) => {
      table.dropColumn('estate_code');
    });
  }
}

export function mapGrantRows(
  grants: ReadonlyArray<{ role: string; permission: string; scope: RolePermissionScope }>,
  roleByCode: ReadonlyMap<string, number>,
  permissionByCode: ReadonlyMap<string, number>,
): Array<{ role_id: number; permission_id: number; scope: RolePermissionScope }> {
  return grants.flatMap((grant) => {
    const roleId = roleByCode.get(grant.role);
    const permissionId = permissionByCode.get(grant.permission);
    if (!roleId || !permissionId) return [];
    return [
      {
        role_id: roleId,
        permission_id: permissionId,
        scope: grant.scope,
      },
    ];
  });
}
