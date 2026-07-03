export type PermissionDataScope =
  | 'ALL'
  | 'IN_REGION'
  | 'IN_PROVINCE'
  | 'IN_ESTATE'
  | 'OWN_FACTORY'
  | null;
export interface PermissionScopeDetails {
  scope: PermissionDataScope;
  region?: string | null;
  province?: string | null;
}
export type PermissionGroup = { data: PermissionDataScope } & Record<
  string,
  true | PermissionDataScope | string | null | undefined
>;
export type PermissionGroups = Record<string, PermissionGroup>;

type PermissionAlias = { module: string; action: string };

const permissionAliases: Record<string, PermissionAlias | PermissionAlias[]> = {
  'dashboard:view': { module: 'dashboard', action: 'view' },
  'dashboard.alerts:view': { module: 'dashboard', action: 'favorite' },
  'dashboard.search:basic': { module: 'dashboard', action: 'search' },
  'dashboard.search:advanced': [
    { module: 'dashboard', action: 'advanced_search' },
    { module: 'conditional_search', action: 'view' },
  ],
  'dashboard.stats:view': [
    { module: 'dashboard', action: 'statistics' },
    { module: 'statistics', action: 'view' },
  ],
  'dashboard.stats:export': { module: 'dashboard', action: 'export' },
  'cems_wpms_requests:view': { module: 'connection', action: 'view' },
  'cems_wpms_requests:edit': { module: 'connection', action: 'edit' },
  'cems_wpms_requests:approve': { module: 'connection', action: 'approve' },
  'helpdesk:submit': { module: 'helpdesk', action: 'view' },
  'feedback:submit': { module: 'feedback', action: 'view' },
  'chat:ask': { module: 'chat', action: 'view' },
  'chat:answer': { module: 'chat', action: 'edit' },
  'permissions:manage': { module: 'permissions', action: 'view' },
  'eligible_factories:manage': { module: 'eligible_factories', action: 'view' },
};

const responseModules = new Set([
  'dashboard',
  'factories',
  'connection',
  'kwp_forms',
  'bod_cod_errors',
  'notifications',
  'statistics',
  'conditional_search',
  'helpdesk',
  'feedback',
  'laws',
  'faq',
  'chat',
  'permissions',
  'eligible_factories',
  'api_documentation',
]);

const scopePriority: Record<string, number> = {
  ALL: 4,
  IN_REGION: 3,
  IN_PROVINCE: 3,
  IN_ESTATE: 2,
  OWN_FACTORY: 1,
};

export function groupPermissions(
  scopes: Record<string, string | null | PermissionScopeDetails>,
): PermissionGroups {
  const groups: PermissionGroups = {};

  for (const [code, permissionScope] of Object.entries(scopes)) {
    const permissions = toPermissionAliases(code);
    for (const permission of permissions) {
      if (!responseModules.has(permission.module)) continue;
      const scopeDetails = toScopeDetails(permissionScope);

      const current = groups[permission.module];
      const currentData = current?.data;
      const nextData = scopeDetails.scope as PermissionDataScope;
      const data = widestScope(currentData, nextData);
      groups[permission.module] = {
        ...(current ?? { data: nextData }),
        data,
        ...(data === nextData ? toGroupLocation(scopeDetails) : {}),
        [permission.action]: true,
      };
    }
  }

  return groups;
}

export function permissionGroupsToScopes(groups: PermissionGroups): Record<string, PermissionDataScope> {
  return Object.fromEntries(
    Object.entries(permissionGroupsToPermissionOverrides(groups)).map(([code, details]) => [
      code,
      details.scope,
    ]),
  );
}

export function permissionGroupsToPermissionOverrides(
  groups: PermissionGroups,
): Record<string, PermissionScopeDetails> {
  const scopes: Record<string, PermissionDataScope> = {};
  const overrides: Record<string, PermissionScopeDetails> = {};

  for (const [module, group] of Object.entries(groups)) {
    for (const [action, enabled] of Object.entries(group)) {
      if (action === 'data' || action === 'region' || action === 'province' || enabled !== true) {
        continue;
      }
      for (const code of permissionCodesFromAlias(module, action)) {
        scopes[code] = group.data;
        overrides[code] = {
          scope: group.data,
          region: normalizeLocationValue(group.region),
          province: normalizeLocationValue(group.province),
        };
      }
    }
  }

  return overrides;
}

function permissionCodesFromAlias(module: string, action: string): string[] {
  const matchedCodes = Object.entries(permissionAliases)
    .filter(([, aliases]) =>
      (Array.isArray(aliases) ? aliases : [aliases]).some(
        (alias) => alias.module === module && alias.action === action,
      ),
    )
    .map(([code]) => code);
  if (matchedCodes.length > 0) return matchedCodes;
  return [`${module}:${action}`];
}

function toPermissionAliases(code: string): Array<{ module: string; action: string }> {
  const alias = permissionAliases[code];
  if (alias) return Array.isArray(alias) ? alias : [alias];

  const separatorIndex = code.indexOf(':');
  if (separatorIndex < 1) return [];

  const resourcePath = code.slice(0, separatorIndex);
  const action = code.slice(separatorIndex + 1);
  const [module, ...children] = resourcePath.split('.');
  const permissionAction = children.length > 0 ? `${children.join('.')}:${action}` : action;
  return [{ module: module!, action: permissionAction }];
}

function widestScope(
  current: PermissionDataScope | undefined,
  next: PermissionDataScope,
): PermissionDataScope {
  if (current === undefined) return next;
  const currentRank = scopePriority[current ?? 'NULL'] ?? 0;
  const nextRank = scopePriority[next ?? 'NULL'] ?? 0;
  return nextRank > currentRank ? next : current;
}

function toScopeDetails(
  value: string | null | PermissionScopeDetails,
): PermissionScopeDetails {
  if (value && typeof value === 'object') {
    return value;
  }
  return { scope: value as PermissionDataScope };
}

function toGroupLocation(
  details: PermissionScopeDetails,
): Partial<Pick<PermissionGroup, 'region' | 'province'>> {
  const location: Partial<Pick<PermissionGroup, 'region' | 'province'>> = {};
  const region = normalizeLocationValue(details.region);
  const province = normalizeLocationValue(details.province);
  if (region !== undefined) location.region = region;
  if (province !== undefined) location.province = province;
  return location;
}

function normalizeLocationValue(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return null;
  return trimmed;
}
