export type PermissionDataScope = 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;
export type PermissionGroup = { data: PermissionDataScope } & Record<
  string,
  true | PermissionDataScope
>;
export type PermissionGroups = Record<string, PermissionGroup>;

const permissionAliases: Record<string, { module: string; action: string }> = {
  'dashboard:view': { module: 'dashboard', action: 'view' },
  'dashboard.alerts:view': { module: 'dashboard', action: 'favorite' },
  'dashboard.search:basic': { module: 'dashboard', action: 'search' },
  'dashboard.search:advanced': { module: 'dashboard', action: 'advanced_search' },
  'dashboard.stats:view': { module: 'dashboard', action: 'statistics' },
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

const scopePriority: Record<string, number> = {
  ALL: 4,
  IN_PROVINCE: 3,
  IN_ESTATE: 2,
  OWN_FACTORY: 1,
};

export function groupPermissions(scopes: Record<string, string | null>): PermissionGroups {
  const groups: PermissionGroups = {};

  for (const [code, scope] of Object.entries(scopes)) {
    const permission = toPermissionAlias(code);
    if (!permission) continue;

    const current = groups[permission.module];
    const currentData = current?.data;
    groups[permission.module] = {
      ...(current ?? { data: scope as PermissionDataScope }),
      data: widestScope(currentData, scope as PermissionDataScope),
      [permission.action]: true,
    };
  }

  return groups;
}

function toPermissionAlias(code: string): { module: string; action: string } | null {
  const alias = permissionAliases[code];
  if (alias) return alias;

  const separatorIndex = code.indexOf(':');
  if (separatorIndex < 1) return null;

  const module = code.slice(0, separatorIndex);
  const action = code.slice(separatorIndex + 1);
  return { module, action };
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
