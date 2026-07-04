import type { Knex } from 'knex';

type Scope = 'ALL' | 'IN_PROVINCE' | 'IN_ESTATE' | 'OWN_FACTORY' | null;

interface Grant {
  role: string;
  permission: string;
  scope: Scope;
}

const ALL: Scope = 'ALL';
const PROV: Scope = 'IN_PROVINCE';
const EST: Scope = 'IN_ESTATE';
const OWN: Scope = 'OWN_FACTORY';

/**
 * สิทธิ์ตาม PERMISSIONS.md ข้อ 5
 * Format: { role, permission, scope }
 * scope = null สำหรับ binary action ที่ไม่มี scope (เช่น helpdesk:submit)
 */
const GRANTS: Grant[] = [
  // === public_anonymous ===
  { role: 'public_anonymous', permission: 'dashboard:view', scope: ALL },
  { role: 'public_anonymous', permission: 'laws:view', scope: null },
  { role: 'public_anonymous', permission: 'faq:view', scope: null },

  // === public_user ===
  { role: 'public_user', permission: 'dashboard:view', scope: ALL },
  { role: 'public_user', permission: 'dashboard.alerts:view', scope: null },
  { role: 'public_user', permission: 'feedback:submit', scope: null },
  { role: 'public_user', permission: 'laws:view', scope: null },
  { role: 'public_user', permission: 'faq:view', scope: null },
  { role: 'public_user', permission: 'chat:ask', scope: null },

  // === factory_operator ===
  { role: 'factory_operator', permission: 'dashboard:view', scope: OWN },
  { role: 'factory_operator', permission: 'dashboard.alerts:view', scope: null },
  { role: 'factory_operator', permission: 'factories:view', scope: OWN },
  { role: 'factory_operator', permission: 'factories:edit', scope: null },
  { role: 'factory_operator', permission: 'cems_wpms_requests:view', scope: OWN },
  { role: 'factory_operator', permission: 'cems_wpms_requests:edit', scope: null },
  { role: 'factory_operator', permission: 'kwp_forms:view', scope: OWN },
  { role: 'factory_operator', permission: 'kwp_forms:edit', scope: null },
  { role: 'factory_operator', permission: 'bod_cod_errors:view', scope: OWN },
  { role: 'factory_operator', permission: 'bod_cod_errors:edit', scope: null },
  { role: 'factory_operator', permission: 'notifications:view', scope: OWN },
  { role: 'factory_operator', permission: 'helpdesk:submit', scope: null },
  { role: 'factory_operator', permission: 'feedback:submit', scope: null },
  { role: 'factory_operator', permission: 'laws:view', scope: null },
  { role: 'factory_operator', permission: 'faq:view', scope: null },
  { role: 'factory_operator', permission: 'chat:ask', scope: null },

  // === diw_central (กรอ.) ===
  { role: 'diw_central', permission: 'dashboard:view', scope: ALL },
  { role: 'diw_central', permission: 'dashboard.alerts:view', scope: null },
  { role: 'diw_central', permission: 'dashboard.search:basic', scope: null },
  { role: 'diw_central', permission: 'dashboard.search:advanced', scope: null },
  { role: 'diw_central', permission: 'dashboard.stats:view', scope: ALL },
  { role: 'diw_central', permission: 'factories:view', scope: ALL },
  { role: 'diw_central', permission: 'kwp_forms:view', scope: ALL },
  { role: 'diw_central', permission: 'bod_cod_errors:view', scope: ALL },
  { role: 'diw_central', permission: 'notifications:view', scope: ALL },
  { role: 'diw_central', permission: 'dashboard.search:basic', scope: null },
  { role: 'diw_central', permission: 'helpdesk:submit', scope: null },
  { role: 'diw_central', permission: 'feedback:submit', scope: null },
  { role: 'diw_central', permission: 'laws:view', scope: null },
  { role: 'diw_central', permission: 'faq:view', scope: null },
  { role: 'diw_central', permission: 'chat:ask', scope: null },

  // === provincial_office (สอจ.) ===
  { role: 'provincial_office', permission: 'dashboard:view', scope: PROV },
  { role: 'provincial_office', permission: 'dashboard.alerts:view', scope: null },
  { role: 'provincial_office', permission: 'dashboard.search:basic', scope: null },
  { role: 'provincial_office', permission: 'dashboard.search:advanced', scope: null },
  { role: 'provincial_office', permission: 'dashboard.stats:view', scope: PROV },
  { role: 'provincial_office', permission: 'factories:view', scope: PROV },
  { role: 'provincial_office', permission: 'kwp_forms:view', scope: PROV },
  { role: 'provincial_office', permission: 'bod_cod_errors:view', scope: PROV },
  { role: 'provincial_office', permission: 'notifications:view', scope: PROV },
  { role: 'provincial_office', permission: 'helpdesk:submit', scope: null },
  { role: 'provincial_office', permission: 'feedback:submit', scope: null },
  { role: 'provincial_office', permission: 'laws:view', scope: null },
  { role: 'provincial_office', permission: 'faq:view', scope: null },
  { role: 'provincial_office', permission: 'chat:ask', scope: null },

  // === industrial_estate (กนอ.) ===
  { role: 'industrial_estate', permission: 'dashboard:view', scope: EST },
  { role: 'industrial_estate', permission: 'dashboard.alerts:view', scope: null },
  { role: 'industrial_estate', permission: 'dashboard.search:basic', scope: null },
  { role: 'industrial_estate', permission: 'dashboard.search:advanced', scope: null },
  { role: 'industrial_estate', permission: 'dashboard.stats:view', scope: EST },
  { role: 'industrial_estate', permission: 'factories:view', scope: EST },
  { role: 'industrial_estate', permission: 'kwp_forms:view', scope: EST },
  { role: 'industrial_estate', permission: 'bod_cod_errors:view', scope: EST },
  { role: 'industrial_estate', permission: 'notifications:view', scope: EST },
  { role: 'industrial_estate', permission: 'helpdesk:submit', scope: null },
  { role: 'industrial_estate', permission: 'feedback:submit', scope: null },
  { role: 'industrial_estate', permission: 'laws:view', scope: null },
  { role: 'industrial_estate', permission: 'faq:view', scope: null },
  { role: 'industrial_estate', permission: 'chat:ask', scope: null },

  // === monitoring_kpm (เจ้าหน้าที่ กฝม.) ===
  { role: 'monitoring_kpm', permission: 'dashboard:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'dashboard.alerts:view', scope: null },
  { role: 'monitoring_kpm', permission: 'dashboard.search:basic', scope: null },
  { role: 'monitoring_kpm', permission: 'dashboard.search:advanced', scope: null },
  { role: 'monitoring_kpm', permission: 'dashboard.stats:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'factories:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'factories:edit', scope: null },
  { role: 'monitoring_kpm', permission: 'factories:approve', scope: null },
  { role: 'monitoring_kpm', permission: 'cems_wpms_requests:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'cems_wpms_requests:edit', scope: null },
  { role: 'monitoring_kpm', permission: 'cems_wpms_requests:approve', scope: null },
  { role: 'monitoring_kpm', permission: 'kwp_forms:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'kwp_forms:edit', scope: null },
  { role: 'monitoring_kpm', permission: 'kwp_forms:approve', scope: null },
  { role: 'monitoring_kpm', permission: 'bod_cod_errors:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'bod_cod_errors:edit', scope: null },
  { role: 'monitoring_kpm', permission: 'bod_cod_errors:approve', scope: null },
  { role: 'monitoring_kpm', permission: 'notifications:view', scope: ALL },
  { role: 'monitoring_kpm', permission: 'helpdesk:submit', scope: null },
  { role: 'monitoring_kpm', permission: 'feedback:submit', scope: null },
  { role: 'monitoring_kpm', permission: 'laws:view', scope: null },
  { role: 'monitoring_kpm', permission: 'faq:view', scope: null },
  { role: 'monitoring_kpm', permission: 'chat:ask', scope: null },
  { role: 'monitoring_kpm', permission: 'chat:answer', scope: null },

  // === monitoring_5_centers ===
  { role: 'monitoring_5_centers', permission: 'dashboard:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'dashboard.alerts:view', scope: null },
  { role: 'monitoring_5_centers', permission: 'dashboard.search:basic', scope: null },
  { role: 'monitoring_5_centers', permission: 'dashboard.search:advanced', scope: null },
  { role: 'monitoring_5_centers', permission: 'dashboard.stats:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'factories:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'factories:edit', scope: null },
  { role: 'monitoring_5_centers', permission: 'factories:approve', scope: null },
  { role: 'monitoring_5_centers', permission: 'kwp_forms:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'kwp_forms:edit', scope: null },
  { role: 'monitoring_5_centers', permission: 'kwp_forms:approve', scope: null },
  { role: 'monitoring_5_centers', permission: 'bod_cod_errors:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'bod_cod_errors:edit', scope: null },
  { role: 'monitoring_5_centers', permission: 'bod_cod_errors:approve', scope: null },
  { role: 'monitoring_5_centers', permission: 'notifications:view', scope: ALL },
  { role: 'monitoring_5_centers', permission: 'helpdesk:submit', scope: null },
  { role: 'monitoring_5_centers', permission: 'feedback:submit', scope: null },
  { role: 'monitoring_5_centers', permission: 'laws:view', scope: null },
  { role: 'monitoring_5_centers', permission: 'faq:view', scope: null },
  { role: 'monitoring_5_centers', permission: 'chat:ask', scope: null },
  { role: 'monitoring_5_centers', permission: 'chat:answer', scope: null },

  // === center_director / kpm_director / kwp_director — view-only at ALL scope ===
  ...(['center_director', 'kpm_director', 'kwp_director'] as const).flatMap((role) => [
    { role, permission: 'dashboard:view', scope: ALL },
    { role, permission: 'dashboard.alerts:view', scope: null },
    { role, permission: 'dashboard.search:basic', scope: null },
    { role, permission: 'dashboard.search:advanced', scope: null },
    { role, permission: 'dashboard.stats:view', scope: ALL },
    { role, permission: 'factories:view', scope: ALL },
    { role, permission: 'kwp_forms:view', scope: ALL },
    { role, permission: 'bod_cod_errors:view', scope: ALL },
    { role, permission: 'notifications:view', scope: ALL },
    { role, permission: 'helpdesk:submit', scope: null },
    { role, permission: 'feedback:submit', scope: null },
    { role, permission: 'laws:view', scope: null },
    { role, permission: 'faq:view', scope: null },
    { role, permission: 'chat:ask', scope: null },
  ]),

  // === admin — ทุกสิทธิ์ + scope = ALL ===
];

export async function seed(knex: Knex): Promise<void> {
  const roles = await knex('roles').select('id', 'code');
  const permissions = await knex('permissions').select('id', 'code');
  const roleByCode = new Map(roles.map((r: { id: number; code: string }) => [r.code, r.id]));
  const permByCode = new Map(permissions.map((p: { id: number; code: string }) => [p.code, p.id]));

  // ลบ grant เดิมก่อน reseed
  await knex('role_permissions').del();

  // Admin ได้ทุก permission scope=ALL
  const adminRoleId = roleByCode.get('admin');
  if (adminRoleId) {
    const adminGrants = permissions.map((p: { id: number; code: string }) => ({
      role_id: adminRoleId,
      permission_id: p.id,
      scope: 'ALL',
    }));
    await knex('role_permissions').insert(adminGrants);
  }

  // Specific grants
  const rows = GRANTS.map((g) => {
    const roleId = roleByCode.get(g.role);
    const permId = permByCode.get(g.permission);
    if (!roleId || !permId) {
      console.warn(`[seed] skipped grant: role=${g.role} perm=${g.permission}`);
      return null;
    }
    return { role_id: roleId, permission_id: permId, scope: g.scope };
  }).filter((x): x is { role_id: number; permission_id: number; scope: Scope } => x !== null);

  // Dedupe (role_id, permission_id) keeping last
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!;
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
