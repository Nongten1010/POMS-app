import type { Knex } from 'knex';
import type { PermissionDataScope } from '../../modules/auth/permissions';
import { mergePermissionScopesWithOverrides } from '../../modules/auth/permissions';
import {
  inferRegionalAccessFromText,
  parseRegionalAccessJson,
} from '../../modules/auth/regional-access';

export interface LegacyPermissionGrant {
  user_id: number;
  permission_id: number;
  code: string;
  scope: PermissionDataScope;
  role_code: string;
  role_deleted_at?: string | Date | null;
}

export interface LegacyPermissionOverride {
  user_id: number;
  permission_id: number;
  code: string;
  effect: 'allow' | 'deny';
  scope: PermissionDataScope;
  region_name: string | null;
  province_id: string | null;
  estate_code: string | null;
  granted_at?: Date | string;
  granted_by?: number | null;
}

export interface LegacyPermissionProfile {
  user_id: number;
  region?: string | null;
  province_id?: string | null;
  estate_code?: string | null;
  regional_access_json?: string | null;
  department_name_th?: string | null;
  line_name_th?: string | null;
}

export type PermissionSnapshotRow = Omit<LegacyPermissionOverride, 'code'>;

export function buildLegacyPermissionSnapshot(
  grants: readonly LegacyPermissionGrant[],
  overrides: readonly LegacyPermissionOverride[],
  profiles: readonly LegacyPermissionProfile[],
): { userIds: number[]; permissions: PermissionSnapshotRow[] } {
  const grantsByUser = groupByUser(grants);
  const overridesByUser = groupByUser(overrides);
  const profilesByUser = new Map(profiles.map((profile) => [Number(profile.user_id), profile]));
  const userIds = [...overridesByUser.keys()].sort((left, right) => left - right);
  const permissions: PermissionSnapshotRow[] = [];
  const ambiguousRegionUserIds = new Set<number>();
  const intersectionUserIds = new Set<number>();

  for (const userId of userIds) {
    const userGrants = grantsByUser.get(userId) ?? [];
    const userOverrides = overridesByUser.get(userId) ?? [];
    const profile = profilesByUser.get(userId);
    const roles = userGrants.filter((row) => !row.role_deleted_at).map((row) => row.role_code);
    const regionalAccess = profile
      ? roles.includes('monitoring_kpm') || roles.includes('kpm_director')
        ? { regions: ['ภาคกลาง'] }
        : (parseRegionalAccessJson(profile.regional_access_json) ??
          inferRegionalAccessFromText(profile.department_name_th, profile.line_name_th))
      : null;
    const regions = regionalAccess?.regions ?? [];
    const roleScopes = mergePermissionScopesWithOverrides(userGrants, [], 'role_default');
    const overrideByCode = new Map<string, LegacyPermissionOverride>();
    for (const row of userOverrides) {
      // An explicit saved denial wins even if duplicate legacy rows exist.
      if (overrideByCode.get(row.code)?.effect !== 'deny') overrideByCode.set(row.code, row);
    }
    const savedOverrides = [...overrideByCode.values()];
    // Role grants fill only codes never configured for the account. Persisted
    // choices take precedence, including actions/scopes outside the former role.
    const scopes: ReturnType<typeof mergePermissionScopesWithOverrides> = { ...roleScopes };
    for (const row of savedOverrides) {
      if (row.effect === 'deny') {
        delete scopes[row.code];
      } else {
        // Snapshot raw choices, not runtime-effective scopes. In particular, a
        // saved NULL must replace its role grant even when it fails closed at runtime.
        scopes[row.code] = {
          scope: row.scope,
          region: row.region_name,
          province: row.province_id,
          estateCode: row.estate_code,
        };
      }
    }
    const permissionIdByCode = new Map(
      [...userGrants, ...savedOverrides].map((row) => [row.code, row.permission_id]),
    );

    for (const [code, value] of Object.entries(scopes)) {
      const details = typeof value === 'object' && value !== null ? value : { scope: value };
      const oldOverride = overrideByCode.get(code);
      let region = oldOverride?.region_name ?? normalizeLocation(details.region);
      let province = oldOverride?.province_id ?? normalizeLocation(details.province);
      let estateCode =
        oldOverride?.estate_code ?? normalizeLocation(details.estateCode ?? details.estate);
      if (details.scope === 'IN_REGION' && !region) {
        if (regions.length > 1) ambiguousRegionUserIds.add(userId);
        if (regions.length === 1) region = regions[0];
      }
      if (
        oldOverride === undefined &&
        regions.length > 0 &&
        (details.scope === 'OWN_FACTORY' || details.scope === null) &&
        (code.startsWith('factories:') || code.startsWith('cems_wpms_requests:'))
      ) {
        // Inherited paths combine ownership with a profile region filter. A scalar
        // cannot preserve that intersection. Explicit saved scopes are authoritative.
        intersectionUserIds.add(userId);
      }
      if (details.scope === 'IN_PROVINCE' && !province) {
        province = normalizeLocation(profile?.province_id);
      }
      if (details.scope === 'IN_ESTATE' && !estateCode) {
        estateCode = normalizeLocation(profile?.estate_code);
      }
      permissions.push({
        user_id: userId,
        permission_id: Number(permissionIdByCode.get(code)),
        effect: 'allow',
        scope: details.scope,
        region_name: region,
        province_id: province,
        estate_code: estateCode,
        granted_by: oldOverride?.granted_by ?? null,
        ...(oldOverride?.granted_at !== undefined ? { granted_at: oldOverride.granted_at } : {}),
      });
    }
    for (const { code: _code, ...row } of savedOverrides.filter((row) => row.effect === 'deny')) {
      permissions.push(row);
    }
  }
  if (ambiguousRegionUserIds.size > 0 || intersectionUserIds.size > 0) {
    const reasons = [
      ...(ambiguousRegionUserIds.size > 0
        ? [`multiple unresolved regions: ${[...ambiguousRegionUserIds].join(', ')}`]
        : []),
      ...(intersectionUserIds.size > 0
        ? [`ownership and region intersection: ${[...intersectionUserIds].join(', ')}`]
        : []),
    ];
    throw new Error(
      `Permission mode migration requires explicit per-menu scopes for user IDs (${reasons.join('; ')}). No permission data was changed.`,
    );
  }
  return { userIds, permissions };
}

export const config = { transaction: true };
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'permission_mode'))) {
    await knex.raw(`
      ALTER TABLE users ADD permission_mode VARCHAR(16) NOT NULL
        CONSTRAINT df_users_permission_mode DEFAULT 'role_default';
    `);
    // SQL Server compiles a batch before executing its ALTER, so validation of
    // the new column must run in a subsequent batch.
    await knex.raw(`
      ALTER TABLE users ADD CONSTRAINT ck_users_permission_mode
        CHECK (permission_mode IN ('role_default', 'custom'));
    `);
  }
  const overrides: LegacyPermissionOverride[] = await knex('user_permissions')
    .join('users', 'users.id', 'user_permissions.user_id')
    .join('permissions', 'permissions.id', 'user_permissions.permission_id')
    .where('users.permission_mode', 'role_default')
    .whereIn('users.user_type', ['officer', 'admin'])
    .select('user_permissions.*', 'permissions.code');
  const userIds = [...new Set(overrides.map((row) => Number(row.user_id)))];
  if (userIds.length === 0) return;
  const grants: LegacyPermissionGrant[] = [];
  const profiles: LegacyPermissionProfile[] = [];
  for (const ids of batches(userIds, 500)) {
    grants.push(
      ...(await knex('user_roles')
        .join('roles', 'roles.id', 'user_roles.role_id')
        .join('role_permissions', 'role_permissions.role_id', 'user_roles.role_id')
        .join('permissions', 'permissions.id', 'role_permissions.permission_id')
        .whereIn('user_roles.user_id', ids)
        .orderBy('user_roles.user_id')
        .orderBy('user_roles.role_id')
        .select(
          'user_roles.user_id',
          'role_permissions.permission_id',
          'permissions.code',
          'role_permissions.scope',
          'roles.code as role_code',
          'roles.deleted_at as role_deleted_at',
        )),
    );
    profiles.push(
      ...(await knex('officer_profiles')
        .join('users', 'users.id', 'officer_profiles.user_id')
        .leftJoin('organizations as department_org', function joinDepartment() {
          this.on('department_org.external_id', '=', 'officer_profiles.department_id').andOnVal(
            'department_org.level',
            '=',
            'department',
          );
        })
        .whereIn('officer_profiles.user_id', ids)
        .whereIn('users.user_type', ['officer', 'admin'])
        .select(
          'officer_profiles.user_id',
          'officer_profiles.province_id',
          'officer_profiles.estate_code',
          'officer_profiles.regional_access_json',
          'officer_profiles.line_name_th',
          knex.raw(
            'COALESCE(officer_profiles.department_name_th, department_org.name_th) as department_name_th',
          ),
        )),
    );
  }
  // Build the whole snapshot (including its preflight) before deleting a row.
  const snapshot = buildLegacyPermissionSnapshot(grants, overrides, profiles);
  for (const ids of batches(snapshot.userIds, 500)) {
    await knex('user_permissions').whereIn('user_id', ids).del();
  }
  // SQL Server limits a request to 2,100 parameters; each row uses at most 9.
  for (const rows of batches(snapshot.permissions, 100)) {
    await knex('user_permissions').insert(rows);
  }
  for (const ids of batches(snapshot.userIds, 500)) {
    await knex('users').whereIn('id', ids).update({ permission_mode: 'custom' });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'permission_mode'))) return;
  const customUser = await knex('users').where('permission_mode', 'custom').first('id');
  if (customUser) {
    throw new Error(
      'Cannot remove permission_mode while custom permission sets exist. Reset or migrate those sets explicitly first.',
    );
  }
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT ck_users_permission_mode;
    ALTER TABLE users DROP CONSTRAINT df_users_permission_mode;
    ALTER TABLE users DROP COLUMN permission_mode;
  `);
}

function groupByUser<T extends { user_id: number }>(rows: readonly T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const userId = Number(row.user_id);
    const current = grouped.get(userId) ?? [];
    current.push(row);
    grouped.set(userId, current);
  }
  return grouped;
}

function normalizeLocation(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function batches<T>(rows: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}
