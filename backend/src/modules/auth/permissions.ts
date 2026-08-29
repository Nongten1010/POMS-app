export type PermissionDataScope =
  | 'ALL'
  | 'IN_REGION'
  | 'IN_PROVINCE'
  | 'IN_ESTATE'
  | 'OWN_FACTORY'
  | 'FACTORY_TYPE_88'
  | null;
export interface PermissionScopeDetails {
  scope: PermissionDataScope;
  region?: string | null;
  province?: string | null;
  estateCode?: string | null;
  estate?: string | null;
}
export interface PersonaPermissionOverride {
  code: string;
  effect: 'allow' | 'deny';
  scope: PermissionDataScope;
  region?: string | null;
  province?: string | null;
  estateCode?: string | null;
  estate?: string | null;
}
export type PermissionGroup = { data?: PermissionDataScope } & Record<
  string,
  boolean | PermissionDataScope | string | null | undefined
>;
export type PermissionGroups = Record<string, PermissionGroup>;

export const EDITABLE_PERMISSION_ACTIONS = {
  dashboard: ['view', 'favorite', 'search', 'advanced_search', 'statistics', 'export'],
  factories: ['view', 'edit', 'approve'],
  connection: ['view', 'edit', 'approve'],
  kwp_forms: ['view', 'edit', 'approve'],
  bod_cod_errors: ['view', 'edit', 'approve'],
  notifications: ['view'],
  statistics: ['view'],
  conditional_search: ['view'],
  helpdesk: ['view'],
  feedback: ['view'],
  laws: ['view', 'edit'],
  faq: ['view', 'edit'],
  chat: ['view', 'edit'],
  permissions: ['view'],
  eligible_factories: ['view', 'edit', 'approve'],
} as const;

export const EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES = new Set<string>([
  'dashboard',
  'factories',
  'connection',
  'kwp_forms',
  'bod_cod_errors',
  'notifications',
  'statistics',
  'conditional_search',
  'eligible_factories',
]);

type PermissionAlias = { module: string; action: string };

const permissionAliases: Record<string, PermissionAlias | PermissionAlias[]> = {
  'dashboard:view': { module: 'dashboard', action: 'view' },
  'dashboard.alerts:view': { module: 'dashboard', action: 'favorite' },
  'dashboard.search:basic': { module: 'dashboard', action: 'search' },
  'dashboard.search:advanced': { module: 'dashboard', action: 'advanced_search' },
  'dashboard.stats:view': { module: 'dashboard', action: 'statistics' },
  'dashboard.stats:export': { module: 'dashboard', action: 'export' },
  'bod_cod_errors:view': { module: 'bod_cod_errors', action: 'view' },
  'bod_cod_errors:edit': { module: 'bod_cod_errors', action: 'edit' },
  'bod_cod_errors:approve': { module: 'bod_cod_errors', action: 'approve' },
  'cems_wpms_requests:view': { module: 'connection', action: 'view' },
  'cems_wpms_requests:edit': { module: 'connection', action: 'edit' },
  'cems_wpms_requests:approve': { module: 'connection', action: 'approve' },
  'cems_wpms_requests:direct_connect': { module: 'connection', action: 'direct_connect' },
  'chat:view': { module: 'chat', action: 'view' },
  'chat:ask': { module: 'chat', action: 'ask' },
  'chat:answer': [
    { module: 'chat', action: 'edit' },
    { module: 'chat', action: 'answer' },
  ],
  'helpdesk:submit': { module: 'helpdesk', action: 'view' },
  'feedback:submit': { module: 'feedback', action: 'view' },
  'eligible_factories:view': { module: 'eligible_factories', action: 'view' },
  'eligible_factories:edit': { module: 'eligible_factories', action: 'edit' },
  'eligible_factories:approve': { module: 'eligible_factories', action: 'approve' },
  'eligible_factories:manage': { module: 'eligible_factories', action: 'manage' },
};

const editablePermissionCodes = new Set(
  Object.entries(EDITABLE_PERMISSION_ACTIONS).flatMap(([module, actions]) =>
    actions.flatMap((action) => permissionCodesFromAlias(module, action)),
  ),
);

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

const locationScopedPermissionModules = new Set([
  'dashboard',
  'factories',
  'connection',
  'kwp_forms',
  'bod_cod_errors',
  'notifications',
  'statistics',
  'conditional_search',
  'eligible_factories',
]);

const binaryPermissionCodes = new Set([
  'dashboard.alerts:view',
  'helpdesk:submit',
  'feedback:submit',
  'laws:view',
  'laws:edit',
  'faq:view',
  'faq:edit',
  'chat:view',
  'chat:ask',
  'chat:answer',
  'permissions:view',
  'permissions:manage',
  'eligible_factories:manage',
  'api_documentation:view',
  'users:view',
  'users:edit',
  'roles:view',
  'roles:edit',
  'audit:view',
]);

const scopePriority: Record<string, number> = {
  ALL: 5,
  IN_REGION: 4,
  IN_PROVINCE: 3,
  IN_ESTATE: 2,
  OWN_FACTORY: 1,
  FACTORY_TYPE_88: 1,
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
      const nextData = groupedDataScope(permission.module, scopeDetails.scope);
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

/** Projects effective permissions into the stable matrix editable by Permission Management. */
export function projectEditablePermissionGroups(groups: PermissionGroups): PermissionGroups {
  return Object.fromEntries(
    Object.entries(EDITABLE_PERMISSION_ACTIONS).map(([module, actions]) => {
      const current = groups[module] ?? {};
      const projected: PermissionGroup = {};

      if (EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES.has(module)) {
        projected.data = current.data ?? null;
        projected.region = normalizeLocationValue(current.region) ?? null;
        projected.province = normalizeLocationValue(current.province) ?? null;
      }

      for (const action of actions) {
        projected[action] = current[action] === true;
      }

      return [module, projected];
    }),
  );
}

export function isEditablePermissionCode(code: string): boolean {
  return editablePermissionCodes.has(code);
}

export function permissionGroupsToScopes(
  groups: PermissionGroups,
): Record<string, PermissionDataScope> {
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
      if (
        action === 'data' ||
        action === 'region' ||
        action === 'province' ||
        action === 'estate' ||
        action === 'estateCode' ||
        enabled !== true
      ) {
        continue;
      }
      for (const code of permissionCodesFromAlias(module, action)) {
        if (overrides[code] && !isPrimaryPermissionAlias(code, module, action)) {
          continue;
        }
        const scope = rawPermissionScope(code, group.data ?? null);
        scopes[code] = scope;
        overrides[code] = {
          scope,
          region: normalizeLocationValue(group.region),
          province: normalizeLocationValue(group.province),
          estateCode: normalizeLocationValue(group.estateCode ?? group.estate),
          estate: normalizeLocationValue(group.estate ?? group.estateCode),
        };
      }
    }
  }

  return overrides;
}

/** Converts an editable permission matrix into explicit allow/deny overrides. */
export function permissionGroupsToUserPermissionOverrides(
  groups: PermissionGroups,
): PersonaPermissionOverride[] {
  const overrides = new Map<string, PersonaPermissionOverride>();

  for (const [module, group] of Object.entries(groups)) {
    for (const [action, enabled] of Object.entries(group)) {
      if (
        action === 'data' ||
        action === 'region' ||
        action === 'province' ||
        action === 'estate' ||
        action === 'estateCode' ||
        typeof enabled !== 'boolean'
      ) {
        continue;
      }

      for (const code of permissionCodesFromAlias(module, action)) {
        if (overrides.has(code) && !isPrimaryPermissionAlias(code, module, action)) continue;
        const scope = rawPermissionScope(code, group.data ?? null);
        const isDenied =
          enabled === false ||
          (group.data === null &&
            (locationScopedPermissionModules.has(module) || module === 'permissions'));
        const region = !isDenied ? normalizeLocationValue(group.region) : undefined;
        const province = !isDenied ? normalizeLocationValue(group.province) : undefined;
        const estateCode = !isDenied
          ? normalizeLocationValue(group.estateCode ?? group.estate)
          : undefined;
        overrides.set(code, {
          code,
          effect: isDenied ? 'deny' : 'allow',
          scope: isDenied ? null : scope,
          ...(region !== undefined ? { region } : {}),
          ...(province !== undefined ? { province } : {}),
          ...(estateCode !== undefined ? { estateCode, estate: estateCode } : {}),
        });
      }
    }
  }

  return [...overrides.values()];
}

export function flattenPermissionScopes(
  scopes: Record<string, string | null | PermissionScopeDetails>,
): Record<string, PermissionDataScope> {
  return Object.fromEntries(
    Object.entries(scopes).map(([code, details]) => [code, toScopeDetails(details).scope]),
  );
}

export function applyPersonaPermissionOverrides(
  roleScopes: Readonly<Record<string, PermissionDataScope>>,
  overrides: readonly PersonaPermissionOverride[],
): Record<string, PermissionDataScope | PermissionScopeDetails> {
  return mergePermissionScopesWithOverrides(
    Object.entries(roleScopes).map(([code, scope]) => ({ code, scope })),
    overrides,
  );
}

export function mergePermissionScopesWithOverrides(
  rolePermissions: ReadonlyArray<{ code: string; scope: PermissionDataScope }>,
  overrides: readonly PersonaPermissionOverride[],
): Record<string, PermissionDataScope | PermissionScopeDetails> {
  const scopes: Record<string, PermissionDataScope | PermissionScopeDetails> = {};

  for (const permission of rolePermissions) {
    const current = scopes[permission.code];
    const currentScope = current && typeof current === 'object' ? current.scope : current;
    scopes[permission.code] = widestScope(currentScope, permission.scope);
  }

  const baseScopes = Object.fromEntries(
    Object.entries(scopes).map(([code, details]) => [
      code,
      (details && typeof details === 'object' ? details.scope : details) as PermissionDataScope,
    ]),
  );

  for (const override of overrides) {
    if (!(override.code in baseScopes)) continue;
    if (override.effect === 'deny') {
      delete scopes[override.code];
      continue;
    }

    const roleScope = baseScopes[override.code];
    if (!isSameOrNarrowerPermissionScope(override.scope, roleScope)) continue;
    const estateCode = normalizeLocationValue(override.estateCode ?? override.estate);
    scopes[override.code] = {
      scope: override.scope,
      region: override.region,
      province: override.province,
      ...(estateCode !== undefined ? { estateCode, estate: estateCode } : {}),
    };
  }

  return scopes;
}

export function isSameOrNarrowerPermissionScope(
  candidate: PermissionDataScope,
  roleScope: PermissionDataScope | undefined,
): boolean {
  if (roleScope === null || roleScope === undefined) return candidate === roleScope;
  if (candidate === null) return false;

  const allowedScopes: Record<Exclude<PermissionDataScope, null>, PermissionDataScope[]> = {
    ALL: ['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'],
    IN_REGION: ['IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY'],
    IN_PROVINCE: ['IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY'],
    IN_ESTATE: ['IN_ESTATE', 'OWN_FACTORY'],
    OWN_FACTORY: ['OWN_FACTORY'],
    FACTORY_TYPE_88: ['FACTORY_TYPE_88'],
  };
  return allowedScopes[roleScope].includes(candidate);
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

function isPrimaryPermissionAlias(code: string, module: string, action: string): boolean {
  const aliases = permissionAliases[code];
  if (!aliases) return true;
  const [primaryAlias] = Array.isArray(aliases) ? aliases : [aliases];
  return primaryAlias?.module === module && primaryAlias.action === action;
}

function toPermissionAliases(code: string): Array<{ module: string; action: string }> {
  const alias = permissionAliases[code];
  if (alias) return Array.isArray(alias) ? alias : [alias];

  const separatorIndex = code.indexOf(':');
  if (separatorIndex < 1) return [];

  const resourcePath = code.slice(0, separatorIndex);
  const action = code.slice(separatorIndex + 1);
  const resourceSegments = resourcePath.split('.');
  const [module, ...children] = resourceSegments;
  if (!module) return [];
  const permissionAction = children.length > 0 ? `${children.join('.')}:${action}` : action;
  return [{ module, action: permissionAction }];
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

function groupedDataScope(module: string, scope: PermissionDataScope): PermissionDataScope {
  return module === 'permissions' ? 'ALL' : scope;
}

function rawPermissionScope(code: string, scope: PermissionDataScope): PermissionDataScope {
  return binaryPermissionCodes.has(code) ? null : scope;
}

function toScopeDetails(value: string | null | PermissionScopeDetails): PermissionScopeDetails {
  if (value && typeof value === 'object') {
    return value;
  }
  return { scope: value as PermissionDataScope };
}

function toGroupLocation(
  details: PermissionScopeDetails,
): Partial<Pick<PermissionGroup, 'region' | 'province' | 'estate' | 'estateCode'>> {
  const location: Partial<Pick<PermissionGroup, 'region' | 'province' | 'estate' | 'estateCode'>> =
    {};
  const region = normalizeLocationValue(details.region);
  const province = normalizeLocationValue(details.province);
  const estateCode = normalizeLocationValue(details.estateCode ?? details.estate);
  if (region !== undefined) location.region = region;
  if (province !== undefined) location.province = province;
  if (estateCode !== undefined) {
    location.estateCode = estateCode;
    location.estate = estateCode;
  }
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
