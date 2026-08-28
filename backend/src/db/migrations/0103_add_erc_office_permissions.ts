import type { Knex } from 'knex';

const ERC_ROLE = {
  code: 'erc_office',
  name_th: 'สำนักงานกำกับกิจการพลังงาน (กกพ.)',
  name_en: 'Energy Regulatory Commission Office',
};
const ELIGIBLE_APPROVE_PERMISSION = {
  code: 'eligible_factories:approve',
  resource: 'eligible_factories',
  action: 'approve',
  description: 'อนุมัติการเลือกโรงงานที่เข้าข่ายจากแบบคำขอเชื่อมต่อ',
};
const FACTORY_TYPE_88_SCOPE = 'FACTORY_TYPE_88';
const ERC_DATA_PERMISSIONS = [
  'dashboard:view',
  'dashboard.search:basic',
  'dashboard.search:advanced',
  'dashboard.stats:view',
  'dashboard.stats:export',
  'statistics:view',
  'statistics:export',
  'conditional_search:view',
  'factories:view',
  'cems_wpms_requests:view',
  'kwp_forms:view',
  'bod_cod_errors:view',
  'notifications:view',
  'eligible_factories:view',
] as const;
const ERC_BINARY_PERMISSIONS = [
  'dashboard.alerts:view',
  'helpdesk:submit',
  'feedback:submit',
  'chat:view',
  'chat:ask',
  'laws:view',
  'faq:view',
] as const;

export async function up(knex: Knex): Promise<void> {
  const existingRole = await knex('roles')
    .where({ code: ERC_ROLE.code })
    .first<{ id: number }>('id');
  if (existingRole) {
    await knex('roles')
      .where({ id: existingRole.id })
      .update({
        name_th: ERC_ROLE.name_th,
        name_en: ERC_ROLE.name_en,
        is_system: true,
        deleted_at: null,
        updated_at: knex.raw('SYSDATETIME()'),
      });
  } else {
    await knex('roles').insert({ ...ERC_ROLE, is_system: true });
  }

  const existingPermission = await knex('permissions')
    .where({ code: ELIGIBLE_APPROVE_PERMISSION.code })
    .first<{ id: number }>('id');
  if (existingPermission) {
    await knex('permissions').where({ id: existingPermission.id }).update({
      resource: ELIGIBLE_APPROVE_PERMISSION.resource,
      action: ELIGIBLE_APPROVE_PERMISSION.action,
      description: ELIGIBLE_APPROVE_PERMISSION.description,
    });
  } else {
    await knex('permissions').insert(ELIGIBLE_APPROVE_PERMISSION);
  }

  const roleRows: Array<{ id: number; code: string }> = await knex('roles')
    .whereIn('code', [ERC_ROLE.code, 'admin'])
    .whereNull('deleted_at')
    .select('id', 'code');
  const permissionCodes = [
    ...ERC_DATA_PERMISSIONS,
    ...ERC_BINARY_PERMISSIONS,
    ELIGIBLE_APPROVE_PERMISSION.code,
  ];
  const permissionRows: Array<{ id: number; code: string }> = await knex('permissions')
    .whereIn('code', permissionCodes)
    .select('id', 'code');
  const roleByCode = new Map(roleRows.map((row) => [row.code, row.id]));
  const permissionByCode = new Map(permissionRows.map((row) => [row.code, row.id]));
  const ercRoleId = roleByCode.get(ERC_ROLE.code);
  if (!ercRoleId) throw new Error('ERC role was not created');

  await knex('role_permissions').where({ role_id: ercRoleId }).del();
  const ercGrantRows = [
    ...ERC_DATA_PERMISSIONS.map((code) => ({
      role_id: ercRoleId,
      permission_id: requiredPermissionId(permissionByCode, code),
      scope: FACTORY_TYPE_88_SCOPE,
    })),
    ...ERC_BINARY_PERMISSIONS.map((code) => ({
      role_id: ercRoleId,
      permission_id: requiredPermissionId(permissionByCode, code),
      scope: null,
    })),
  ];
  await knex('role_permissions').insert(ercGrantRows);

  const adminRoleId = roleByCode.get('admin');
  const approvePermissionId = requiredPermissionId(
    permissionByCode,
    ELIGIBLE_APPROVE_PERMISSION.code,
  );
  if (adminRoleId) {
    const adminGrant = await knex('role_permissions')
      .where({ role_id: adminRoleId, permission_id: approvePermissionId })
      .first('role_id');
    if (adminGrant) {
      await knex('role_permissions')
        .where({ role_id: adminRoleId, permission_id: approvePermissionId })
        .update({ scope: 'ALL' });
    } else {
      await knex('role_permissions').insert({
        role_id: adminRoleId,
        permission_id: approvePermissionId,
        scope: 'ALL',
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const role = await knex('roles').where({ code: ERC_ROLE.code }).first<{ id: number }>('id');
  if (role) {
    await knex('user_roles').where({ role_id: role.id }).del();
    await knex('role_permissions').where({ role_id: role.id }).del();
    await knex('roles').where({ id: role.id }).del();
  }

  const permission = await knex('permissions')
    .where({ code: ELIGIBLE_APPROVE_PERMISSION.code })
    .first<{ id: number }>('id');
  if (permission) {
    await knex('user_permissions').where({ permission_id: permission.id }).del();
    await knex('role_permissions').where({ permission_id: permission.id }).del();
    await knex('permissions').where({ id: permission.id }).del();
  }
}

function requiredPermissionId(permissionByCode: ReadonlyMap<string, number>, code: string): number {
  const permissionId = permissionByCode.get(code);
  if (!permissionId) throw new Error(`Missing permission required by ERC role: ${code}`);
  return permissionId;
}
