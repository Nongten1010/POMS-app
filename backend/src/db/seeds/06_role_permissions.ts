import type { Knex } from 'knex';
import {
  RBAC_MATRIX_V20260810_GRANTS as GRANTS,
  type RolePermissionScope,
} from './rbac_matrix_v20260810';

export { GRANTS };

export async function seed(knex: Knex): Promise<void> {
  const roles = await knex('roles').select('id', 'code');
  const permissions = await knex('permissions').select('id', 'code');
  const roleByCode = new Map(roles.map((r: { id: number; code: string }) => [r.code, r.id]));
  const permByCode = new Map(permissions.map((p: { id: number; code: string }) => [p.code, p.id]));

  // ลบ grant เดิมก่อน reseed
  await knex('role_permissions').del();

  // Specific grants
  const rows = GRANTS.map((g) => {
    const roleId = roleByCode.get(g.role);
    const permId = permByCode.get(g.permission);
    if (!roleId || !permId) {
      console.warn(`[seed] skipped grant: role=${g.role} perm=${g.permission}`);
      return null;
    }
    return { role_id: roleId, permission_id: permId, scope: g.scope };
  }).filter(
    (x): x is { role_id: number; permission_id: number; scope: RolePermissionScope } => x !== null,
  );

  // Dedupe (role_id, permission_id) keeping last
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (!r) continue;
    const key = `${r.role_id}:${r.permission_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.unshift(r);
    }
  }

  if (deduped.length > 0) {
    await knex('role_permissions').insert(deduped);
  }
}
