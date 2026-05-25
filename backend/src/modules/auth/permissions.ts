export type PermissionDataScope = 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;
export type PermissionGroup = { data: PermissionDataScope } & Record<
  string,
  true | PermissionDataScope
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
  IN_PROVINCE: 3,
  IN_ESTATE: 2,
  OWN_FACTORY: 1,
};

export function groupPermissions(scopes: Record<string, string | null>): PermissionGroups {
  const groups: PermissionGroups = {};

  for (const [code, scope] of Object.entries(scopes)) {
    const permissions = toPermissionAliases(code);
    for (const permission of permissions) {
      if (!responseModules.has(permission.module)) continue;

      const current = groups[permission.module];
      const currentData = current?.data;
      groups[permission.module] = {
        ...(current ?? { data: scope as PermissionDataScope }),
        data: widestScope(currentData, scope as PermissionDataScope),
        [permission.action]: true,
      };
    }
  }

  return groups;
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
