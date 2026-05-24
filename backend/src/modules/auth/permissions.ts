export type PermissionGroups = Record<string, Record<string, true>>;

export function groupPermissions(scopes: Record<string, string | null>): PermissionGroups {
  const groups: PermissionGroups = {};

  for (const code of Object.keys(scopes)) {
    const separatorIndex = code.indexOf(':');
    if (separatorIndex < 1) continue;

    const resourcePath = code.slice(0, separatorIndex);
    const action = code.slice(separatorIndex + 1);
    const [resource, ...children] = resourcePath.split('.');
    const permissionKey = children.length > 0 ? `${children.join('.')}:${action}` : action;

    groups[resource] ??= {};
    groups[resource][permissionKey] = true;
  }

  return groups;
}

