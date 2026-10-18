import type { Knex } from 'knex';
import {
  inferRegionalAccessFromText,
  parseRegionalAccessJson,
} from '../../modules/auth/regional-access';

// Keep the legacy merge rules here: future permission changes must not alter a
// migration's interpretation of the audience that existed before this release.
type Scope = 'ALL' | 'IN_REGION' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | 'FACTORY_TYPE_88';
type LegacyScope = Scope | null;
const chatCodes = ['chat:view', 'chat:ask', 'chat:answer'];
const scopeRank: Record<Scope, number> = {
  ALL: 5,
  IN_REGION: 4,
  IN_PROVINCE: 3,
  IN_ESTATE: 2,
  OWN_FACTORY: 1,
  FACTORY_TYPE_88: 1,
};
const narrowerScopes: Record<Scope, readonly Scope[]> = {
  ALL: ['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'],
  IN_REGION: ['IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY'],
  IN_PROVINCE: ['IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY'],
  IN_ESTATE: ['IN_ESTATE', 'OWN_FACTORY'],
  OWN_FACTORY: ['OWN_FACTORY'],
  FACTORY_TYPE_88: ['FACTORY_TYPE_88'],
};

export interface ChatScopeRoleGrant {
  role_id: number;
  permission_id: number;
  code: string;
  scope: string | null;
}
export interface ChatScopeMembership {
  user_id: number;
  role_id: number;
  role_code: string;
  role_deleted_at?: Date | string | null;
}
export interface ChatScopeUser {
  id: number;
  permission_mode: 'role_default' | 'custom';
}
export interface ChatScopeOverride {
  user_id: number;
  permission_id: number;
  code: string;
  effect: 'allow' | 'deny';
  scope: string | null;
  region_name: string | null;
  province_id: string | null;
  estate_code: string | null;
}
export interface ChatScopeProfile {
  user_id: number;
  province_id?: string | null;
  estate_code?: string | null;
  regional_access_json?: string | null;
  department_name_th?: string | null;
  line_name_th?: string | null;
}
interface ScopeDetails {
  scope: LegacyScope;
  region_name: string | null;
  province_id: string | null;
  estate_code: string | null;
}
export type ChatScopeUserWrite = ScopeDetails & {
  user_id: number;
  permission_id: number;
  effect: 'allow' | 'deny';
};
export interface ChatScopeBackfill {
  roleUpdates: Array<{ role_id: number; permission_id: number; scope: Scope }>;
  userUpdates: ChatScopeUserWrite[];
  userInserts: ChatScopeUserWrite[];
}

export function buildChatPermissionScopeBackfill(
  roleGrants: readonly ChatScopeRoleGrant[],
  memberships: readonly ChatScopeMembership[],
  users: readonly ChatScopeUser[],
  overrides: readonly ChatScopeOverride[],
  profiles: readonly ChatScopeProfile[],
): ChatScopeBackfill {
  const result: ChatScopeBackfill = { roleUpdates: [], userUpdates: [], userInserts: [] };
  const grantsByRole = groupBy(roleGrants, (row) => Number(row.role_id));
  const membershipsByUser = groupBy(memberships, (row) => Number(row.user_id));
  const overridesByUser = groupBy(overrides, (row) => Number(row.user_id));
  const profilesByUser = new Map(profiles.map((row) => [Number(row.user_id), row]));
  const nextRoleGrants = roleGrants.map((row) => {
    if (!chatCodes.includes(row.code) || row.scope !== null) return row;
    const eligible = grantsByRole
      .get(Number(row.role_id))
      ?.find((grant) => grant.code === 'eligible_factories:view');
    if (!isScope(eligible?.scope)) return row;
    result.roleUpdates.push({
      role_id: Number(row.role_id),
      permission_id: Number(row.permission_id),
      scope: eligible.scope,
    });
    return { ...row, scope: eligible.scope };
  });
  const nextGrantsByRole = groupBy(nextRoleGrants, (row) => Number(row.role_id));

  for (const user of users) {
    const userId = Number(user.id);
    const userMemberships = membershipsByUser.get(userId) ?? [];
    const oldGrants = userMemberships.flatMap((row) => grantsByRole.get(Number(row.role_id)) ?? []);
    const nextGrants = userMemberships.flatMap(
      (row) => nextGrantsByRole.get(Number(row.role_id)) ?? [],
    );
    const savedByCode = new Map<string, ChatScopeOverride>();
    for (const row of overridesByUser.get(userId) ?? []) {
      if (savedByCode.get(row.code)?.effect !== 'deny') savedByCode.set(row.code, row);
    }
    const custom = user.permission_mode === 'custom';
    const eligible = effectiveScope(
      oldGrants,
      savedByCode.get('eligible_factories:view'),
      'eligible_factories:view',
      custom,
    );
    const audience = eligible
      ? withLegacyLocation(eligible, profilesByUser.get(userId), userMemberships, custom)
      : null;

    for (const code of chatCodes) {
      const saved = savedByCode.get(code);
      if (saved?.effect === 'deny') continue;
      const oldBase = custom ? undefined : mergedRoleScope(oldGrants, code);
      const nextBase = custom ? undefined : mergedRoleScope(nextGrants, code);
      const oldEffective = effectiveScope(oldGrants, saved, code, custom);
      if (!oldEffective) continue; // No role/custom grant: never introduce an action.

      if (saved?.scope !== null && saved !== undefined) {
        // An ignored saved scope cannot represent the old eligible audience
        // once its inherited cap changes. Deny rather than activating it or
        // exposing a different inherited audience underneath that ignored row.
        if (!custom && !fits(saved.scope, oldBase) && oldBase !== nextBase) {
          result.userUpdates.push(userWrite(userId, saved.permission_id, null, 'deny'));
        }
        // Effective explicit scoped grants are already an intentional contract.
        continue;
      }
      if (oldEffective.scope !== null) continue;
      const permissionId =
        saved?.permission_id ?? oldGrants.find((row) => row.code === code)?.permission_id;
      if (permissionId === undefined) continue;

      // Custom snapshots never borrow a role or profile audience. A missing
      // eligible grant keeps a custom null Chat allow closed in the new runtime.
      if (custom) {
        if (audience && hasRequiredLocation(audience, false)) {
          result.userUpdates.push(userWrite(userId, permissionId, audience));
        }
        continue;
      }

      // An unqualified null override would be ignored under a scoped role. Use
      // an explicit denial when the old audience cannot be safely represented.
      const usable =
        audience &&
        hasRequiredLocation(
          audience,
          legacyProfileRegions(profilesByUser.get(userId), userMemberships).length > 0,
        ) &&
        fits(audience.scope, nextBase);
      const write = userWrite(
        userId,
        permissionId,
        usable ? audience : null,
        usable ? 'allow' : 'deny',
      );
      (saved ? result.userUpdates : result.userInserts).push(write);
    }
  }
  return result;
}

function effectiveScope(
  grants: readonly ChatScopeRoleGrant[],
  saved: ChatScopeOverride | undefined,
  code: string,
  custom: boolean,
): ScopeDetails | null {
  const base = custom ? undefined : mergedRoleScope(grants, code);
  if (custom ? !saved : base === undefined) return null;
  if (saved?.effect === 'deny') return null;
  if (saved && (custom || fits(saved.scope, base))) {
    if (saved.scope !== null && !isScope(saved.scope)) return null;
    return {
      scope: saved.scope,
      region_name: normalizeLocation(saved.region_name),
      province_id: normalizeLocation(saved.province_id),
      estate_code: normalizeLocation(saved.estate_code),
    };
  }
  if (base !== null && !isScope(base)) return null;
  return emptyDetails(base ?? null);
}

function withLegacyLocation(
  details: ScopeDetails,
  profile: ChatScopeProfile | undefined,
  memberships: readonly ChatScopeMembership[],
  custom: boolean,
): ScopeDetails | null {
  if (!isScope(details.scope)) return null;
  const audience = { ...details };
  if (custom || !profile) return audience;
  const regions = legacyProfileRegions(profile, memberships);
  if (audience.scope === 'IN_REGION' && !audience.region_name && regions.length === 1)
    audience.region_name = regions[0] ?? null;
  if (audience.scope === 'IN_PROVINCE' && !audience.province_id)
    audience.province_id = normalizeLocation(profile.province_id);
  if (audience.scope === 'IN_ESTATE' && !audience.estate_code)
    audience.estate_code = normalizeLocation(profile.estate_code);
  return audience;
}

function legacyProfileRegions(
  profile: ChatScopeProfile | undefined,
  memberships: readonly ChatScopeMembership[],
): string[] {
  if (!profile) return [];
  const roleCodes = memberships.filter((row) => !row.role_deleted_at).map((row) => row.role_code);
  return roleCodes.includes('monitoring_kpm') || roleCodes.includes('kpm_director')
    ? ['ภาคกลาง']
    : ((
        parseRegionalAccessJson(profile.regional_access_json) ??
        inferRegionalAccessFromText(profile.department_name_th, profile.line_name_th)
      )?.regions ?? []);
}

function mergedRoleScope(
  grants: readonly ChatScopeRoleGrant[],
  code: string,
): string | null | undefined {
  let current: string | null | undefined;
  let ambiguous = false;
  for (const row of grants.filter((grant) => grant.code === code)) {
    const nextRank = isScope(row.scope) ? scopeRank[row.scope] : 0;
    const currentRank = isScope(current) ? scopeRank[current] : 0;
    if (current === undefined || nextRank > currentRank) {
      current = row.scope;
      ambiguous = false;
    } else if (nextRank > 0 && nextRank === currentRank && row.scope !== current) {
      // OWN_FACTORY and FACTORY_TYPE_88 tie in the legacy merge. Query order is
      // not a reliable audience snapshot, so require explicit remediation.
      ambiguous = true;
    }
  }
  return ambiguous ? 'AMBIGUOUS' : current;
}

function fits(candidate: string | null, ceiling: string | null | undefined): boolean {
  if (ceiling === undefined || ceiling === null) return candidate === ceiling;
  return isScope(ceiling) && isScope(candidate) && narrowerScopes[ceiling].includes(candidate);
}
function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && Object.hasOwn(scopeRank, value);
}
function normalizeLocation(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== 'all' ? normalized : null;
}
function emptyDetails(scope: LegacyScope): ScopeDetails {
  return { scope, region_name: null, province_id: null, estate_code: null };
}
function userWrite(
  userId: number,
  permissionId: number,
  details: ScopeDetails | null,
  effect: 'allow' | 'deny' = 'allow',
): ChatScopeUserWrite {
  return {
    user_id: userId,
    permission_id: Number(permissionId),
    effect,
    ...(details ?? emptyDetails(null)),
  };
}
function hasRequiredLocation(details: ScopeDetails, hasRoleRegions: boolean): boolean {
  return (
    (details.scope !== 'IN_REGION' || Boolean(details.region_name) || hasRoleRegions) &&
    (details.scope !== 'IN_PROVINCE' || Boolean(details.province_id)) &&
    (details.scope !== 'IN_ESTATE' || Boolean(details.estate_code))
  );
}
function groupBy<T>(rows: readonly T[], key: (row: T) => number): Map<number, T[]> {
  const result = new Map<number, T[]>();
  for (const row of rows) result.set(key(row), [...(result.get(key(row)) ?? []), row]);
  return result;
}

export const config = { transaction: true };

export const CHAT_SCOPE_BACKUP_TABLES = {
  role: 'chat_scope_20261018_role_permissions_backup',
  user: 'chat_scope_20261018_user_permissions_backup',
} as const;

/** Fixed identifiers only; no permission/user values are interpolated into SQL. */
export function buildChatPermissionBackupSql(): string {
  return `
    SET NOCOUNT ON;

    IF OBJECT_ID(N'dbo.${CHAT_SCOPE_BACKUP_TABLES.role}', N'U') IS NOT NULL
       OR OBJECT_ID(N'dbo.${CHAT_SCOPE_BACKUP_TABLES.user}', N'U') IS NOT NULL
    BEGIN
      THROW 51420, 'Chat scope backup tables already exist; inspect them before retrying', 1;
    END;

    DECLARE @role_permission_count BIGINT;
    DECLARE @user_permission_count BIGINT;
    SELECT @role_permission_count = COUNT_BIG(*)
    FROM dbo.role_permissions WITH (TABLOCKX, HOLDLOCK);
    SELECT @user_permission_count = COUNT_BIG(*)
    FROM dbo.user_permissions WITH (TABLOCKX, HOLDLOCK);

    -- Another session may have completed the release while source locks waited.
    IF OBJECT_ID(N'dbo.${CHAT_SCOPE_BACKUP_TABLES.role}', N'U') IS NOT NULL
       OR OBJECT_ID(N'dbo.${CHAT_SCOPE_BACKUP_TABLES.user}', N'U') IS NOT NULL
    BEGIN
      THROW 51420, 'Chat scope backup tables already exist; inspect them before retrying', 1;
    END;

    SELECT * INTO dbo.${CHAT_SCOPE_BACKUP_TABLES.role}
    FROM dbo.role_permissions WITH (TABLOCKX, HOLDLOCK);
    SELECT * INTO dbo.${CHAT_SCOPE_BACKUP_TABLES.user}
    FROM dbo.user_permissions WITH (TABLOCKX, HOLDLOCK);

    IF (SELECT COUNT_BIG(*) FROM dbo.${CHAT_SCOPE_BACKUP_TABLES.role}) <> @role_permission_count
       OR (SELECT COUNT_BIG(*) FROM dbo.${CHAT_SCOPE_BACKUP_TABLES.user}) <> @user_permission_count
    BEGIN
      THROW 51421, 'Chat scope backup row count mismatch; no permissions were changed', 1;
    END;

    SELECT @role_permission_count AS role_permissions_count,
           @user_permission_count AS user_permissions_count;
  `;
}

interface PermissionBackupCounts {
  role_permissions_count: string | number;
  user_permissions_count: string | number;
}

export async function up(knex: Knex): Promise<void> {
  // The migration transaction retains the source table locks through all scope
  // writes. Full-column copies include deny/location/audit data for recovery.
  const backups = await knex.raw<PermissionBackupCounts[]>(buildChatPermissionBackupSql());
  const counts = backups[0];
  if (
    !counts ||
    !/^\d+$/.test(String(counts.role_permissions_count)) ||
    !/^\d+$/.test(String(counts.user_permissions_count))
  ) {
    throw new Error('Chat scope backup verification did not return valid row counts');
  }
  console.log(
    `[migration 0142] verified backup rows: role_permissions=${counts.role_permissions_count}, ` +
      `user_permissions=${counts.user_permissions_count}`,
  );
  const codes = [...chatCodes, 'eligible_factories:view'];
  const roleGrants: ChatScopeRoleGrant[] = await knex('role_permissions')
    .join('permissions', 'permissions.id', 'role_permissions.permission_id')
    .whereIn('permissions.code', codes)
    .select(
      'role_permissions.role_id',
      'role_permissions.permission_id',
      'permissions.code',
      'role_permissions.scope',
    );
  const memberships: ChatScopeMembership[] = [];
  for (const ids of batches([...new Set(roleGrants.map((row) => row.role_id))], 500)) {
    memberships.push(
      ...(await knex('user_roles')
        .join('roles', 'roles.id', 'user_roles.role_id')
        .whereIn('user_roles.role_id', ids)
        .select(
          'user_roles.user_id',
          'user_roles.role_id',
          'roles.code as role_code',
          'roles.deleted_at as role_deleted_at',
        )),
    );
  }
  const overrides: ChatScopeOverride[] = await knex('user_permissions')
    .join('permissions', 'permissions.id', 'user_permissions.permission_id')
    .whereIn('permissions.code', codes)
    .select(
      'user_permissions.user_id',
      'user_permissions.permission_id',
      'permissions.code',
      'user_permissions.effect',
      'user_permissions.scope',
      'user_permissions.region_name',
      'user_permissions.province_id',
      'user_permissions.estate_code',
    );
  const userIds = [...new Set([...memberships, ...overrides].map((row) => Number(row.user_id)))];
  const users: ChatScopeUser[] = [];
  const profiles: ChatScopeProfile[] = [];
  for (const ids of batches(userIds, 500)) {
    users.push(...(await knex('users').whereIn('id', ids).select('id', 'permission_mode')));
    profiles.push(
      ...(await knex('officer_profiles')
        .join('users', 'users.id', 'officer_profiles.user_id')
        .leftJoin(
          'provinces as profile_province',
          'profile_province.id',
          'officer_profiles.province_id',
        )
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
          // Match legacy auth: an orphan profile province never identified an audience.
          'profile_province.id as province_id',
          'officer_profiles.estate_code',
          'officer_profiles.regional_access_json',
          'officer_profiles.line_name_th',
          knex.raw(
            'COALESCE(officer_profiles.department_name_th, department_org.name_th) as department_name_th',
          ),
        )),
    );
  }
  const plan = buildChatPermissionScopeBackfill(
    roleGrants,
    memberships,
    users,
    overrides,
    profiles,
  );
  // Build every user snapshot from old data before changing any inherited cap.
  for (const row of plan.userUpdates) {
    const { user_id, permission_id, ...values } = row;
    await knex('user_permissions').where({ user_id, permission_id }).update(values);
  }
  // 7 columns per row; batches remain below SQL Server's 2,100 parameter limit.
  for (const rows of batches(plan.userInserts, 100)) await knex('user_permissions').insert(rows);
  for (const row of plan.roleUpdates) {
    const { role_id, permission_id, scope } = row;
    await knex('role_permissions')
      .where({ role_id, permission_id })
      .whereNull('scope')
      .update({ scope });
  }
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error(
    'Chat scope backfill cannot be reversed safely: review and restore the pre-migration permission snapshot explicitly.',
  );
}

function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}
