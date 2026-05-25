export type PermissionDataScope = 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;
export type PermissionGroup = { data: PermissionDataScope } & Record<
  string,
  true | PermissionDataScope
>;
export type PermissionGroups = Record<string, PermissionGroup>;

const permissionAliases: Record<string, { module: string; action: string }> = {
  'cems_wpms_requests:view': { module: 'connection', action: 'view' },
  'cems_wpms_requests:edit': { module: 'connection', action: 'edit' },
  'cems_wpms_requests:approve': { module: 'connection', action: 'approve' },
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

  const resourcePath = code.slice(0, separatorIndex);
  const action = code.slice(separatorIndex + 1);
  const [module, ...children] = resourcePath.split('.');
  const permissionAction = children.length > 0 ? `${children.join('.')}:${action}` : action;
  return { module: module!, action: permissionAction };
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
