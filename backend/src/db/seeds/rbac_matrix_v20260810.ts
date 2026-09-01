export type RolePermissionScope =
  | 'ALL'
  | 'IN_REGION'
  | 'IN_PROVINCE'
  | 'IN_ESTATE'
  | 'OWN_FACTORY'
  | 'FACTORY_TYPE_88'
  | null;

export interface PermissionSeedRow {
  code: string;
  resource: string;
  action: string;
  description: string;
}

export interface RolePermissionGrant {
  role: string;
  permission: string;
  scope: RolePermissionScope;
}

export const RBAC_MATRIX_V20260810_ROLE_CODES = [
  'public_anonymous',
  'public_user',
  'factory_operator',
  'diw_central',
  'provincial_office',
  'industrial_estate',
  'erc_office',
  'monitoring_kpm',
  'monitoring_5_centers',
  'center_director',
  'kpm_director',
  'kwp_director',
  'admin',
] as const;

const ALL: RolePermissionScope = 'ALL';
const REG: RolePermissionScope = 'IN_REGION';
const PROV: RolePermissionScope = 'IN_PROVINCE';
const EST: RolePermissionScope = 'IN_ESTATE';
const OWN: RolePermissionScope = 'OWN_FACTORY';
const TYPE_88: RolePermissionScope = 'FACTORY_TYPE_88';
const NONE: RolePermissionScope = null;

const dataGrant = (
  role: string,
  scope: Exclude<RolePermissionScope, null>,
  permissions: readonly string[],
): RolePermissionGrant[] =>
  permissions.map((permission) => ({ role, permission, scope }));

const binaryGrant = (role: string, permissions: readonly string[]): RolePermissionGrant[] =>
  permissions.map((permission) => ({ role, permission, scope: NONE }));

const dashboardScopedPermissions = [
  'dashboard:view',
  'dashboard.search:basic',
  'dashboard.search:advanced',
  'dashboard.stats:view',
  'dashboard.stats:export',
] as const;

const commonReadOnlyBinaryPermissions = ['laws:view', 'faq:view'] as const;
export const RBAC_MATRIX_V20260810_PERMISSIONS: PermissionSeedRow[] = [
  { code: 'dashboard:view', resource: 'dashboard', action: 'view', description: 'ดู dashboard หน้าหลัก' },
  {
    code: 'dashboard.alerts:view',
    resource: 'dashboard.alerts',
    action: 'view',
    description: 'ดูการแจ้งเตือนติดดาว',
  },
  {
    code: 'dashboard.search:basic',
    resource: 'dashboard.search',
    action: 'basic',
    description: 'ค้นหาทั่วไป',
  },
  {
    code: 'dashboard.search:advanced',
    resource: 'dashboard.search',
    action: 'advanced',
    description: 'ค้นหาขั้นสูง',
  },
  {
    code: 'dashboard.stats:view',
    resource: 'dashboard.stats',
    action: 'view',
    description: 'ดูสถิติข้อมูล',
  },
  {
    code: 'dashboard.stats:export',
    resource: 'dashboard.stats',
    action: 'export',
    description: 'ส่งออกข้อมูล',
  },
  {
    code: 'statistics:view',
    resource: 'statistics',
    action: 'view',
    description: 'ดูเมนูสถิติข้อมูล',
  },
  {
    code: 'statistics:export',
    resource: 'statistics',
    action: 'export',
    description: 'ส่งออกข้อมูลจากเมนูสถิติข้อมูล',
  },
  {
    code: 'conditional_search:view',
    resource: 'conditional_search',
    action: 'view',
    description: 'ดูเมนูการสืบค้นข้อมูลแบบมีเงื่อนไข',
  },
  { code: 'factories:view', resource: 'factories', action: 'view', description: 'ดูข้อมูลพื้นฐานโรงงาน' },
  { code: 'factories:edit', resource: 'factories', action: 'edit', description: 'แก้ไขข้อมูลพื้นฐานโรงงาน' },
  {
    code: 'factories:approve',
    resource: 'factories',
    action: 'approve',
    description: 'อนุมัติข้อมูลพื้นฐานโรงงาน',
  },
  {
    code: 'cems_wpms_requests:view',
    resource: 'cems_wpms_requests',
    action: 'view',
    description: 'ดูคำขอเชื่อมต่อ CEMS/WPMS',
  },
  {
    code: 'cems_wpms_requests:edit',
    resource: 'cems_wpms_requests',
    action: 'edit',
    description: 'แก้ไขคำขอเชื่อมต่อ CEMS/WPMS',
  },
  {
    code: 'cems_wpms_requests:approve',
    resource: 'cems_wpms_requests',
    action: 'approve',
    description: 'อนุมัติคำขอเชื่อมต่อ CEMS/WPMS',
  },
  {
    code: 'cems_wpms_requests:direct_connect',
    resource: 'cems_wpms_requests',
    action: 'direct_connect',
    description: 'เพิ่มจุดตรวจวัดและเชื่อมต่อทันทีโดยเจ้าหน้าที่',
  },
  { code: 'kwp_forms:view', resource: 'kwp_forms', action: 'view', description: 'ดูแบบ กวภ. 01-05' },
  { code: 'kwp_forms:edit', resource: 'kwp_forms', action: 'edit', description: 'แก้ไขแบบ กวภ. 01-05' },
  { code: 'kwp_forms:approve', resource: 'kwp_forms', action: 'approve', description: 'อนุมัติแบบ กวภ. 01-05' },
  {
    code: 'bod_cod_errors:view',
    resource: 'bod_cod_errors',
    action: 'view',
    description: 'ดูรายงานค่าความคลาดเคลื่อน BOD/COD',
  },
  {
    code: 'bod_cod_errors:edit',
    resource: 'bod_cod_errors',
    action: 'edit',
    description: 'แก้ไขรายงานค่าความคลาดเคลื่อน BOD/COD',
  },
  {
    code: 'bod_cod_errors:approve',
    resource: 'bod_cod_errors',
    action: 'approve',
    description: 'อนุมัติรายงานค่าความคลาดเคลื่อน BOD/COD',
  },
  { code: 'notifications:view', resource: 'notifications', action: 'view', description: 'ดูการแจ้งเตือน' },
  {
    code: 'notifications:view_status',
    resource: 'notifications',
    action: 'view_status',
    description: 'ดูสถานะการแจ้งเตือน',
  },
  { code: 'notifications:edit', resource: 'notifications', action: 'edit', description: 'แก้ไขการแจ้งเตือน' },
  {
    code: 'notifications:approve',
    resource: 'notifications',
    action: 'approve',
    description: 'อนุมัติการแจ้งเตือน',
  },
  { code: 'helpdesk:submit', resource: 'helpdesk', action: 'submit', description: 'แจ้งขอความช่วยเหลือ' },
  { code: 'feedback:submit', resource: 'feedback', action: 'submit', description: 'ส่งข้อเสนอแนะ' },
  { code: 'laws:view', resource: 'laws', action: 'view', description: 'ดูกฎหมายที่เกี่ยวข้อง' },
  { code: 'laws:edit', resource: 'laws', action: 'edit', description: 'แก้ไขกฎหมายที่เกี่ยวข้อง' },
  { code: 'faq:view', resource: 'faq', action: 'view', description: 'ดูคำถามที่พบบ่อย' },
  { code: 'faq:edit', resource: 'faq', action: 'edit', description: 'แก้ไขคำถามที่พบบ่อย' },
  { code: 'chat:view', resource: 'chat', action: 'view', description: 'ดูหน้า chat' },
  { code: 'chat:ask', resource: 'chat', action: 'ask', description: 'ถามคำถามใน chat' },
  { code: 'chat:answer', resource: 'chat', action: 'answer', description: 'ตอบคำถามใน chat' },
  {
    code: 'permissions:view',
    resource: 'permissions',
    action: 'view',
    description: 'ดูเมนูจัดการสิทธิ์การใช้งาน',
  },
  {
    code: 'permissions:manage',
    resource: 'permissions',
    action: 'manage',
    description: 'จัดการสิทธิ์การใช้งาน',
  },
  {
    code: 'eligible_factories:view',
    resource: 'eligible_factories',
    action: 'view',
    description: 'ดูเมนูโรงงานที่เข้าข่าย',
  },
  {
    code: 'eligible_factories:edit',
    resource: 'eligible_factories',
    action: 'edit',
    description: 'แก้ไขโรงงานที่เข้าข่าย',
  },
  {
    code: 'eligible_factories:approve',
    resource: 'eligible_factories',
    action: 'approve',
    description: 'อนุมัติการเลือกโรงงานที่เข้าข่ายจากแบบคำขอเชื่อมต่อ',
  },
  {
    code: 'eligible_factories:manage',
    resource: 'eligible_factories',
    action: 'manage',
    description: 'จัดการโรงงานที่เข้าข่าย (deprecated compatibility)',
  },
  {
    code: 'api_documentation:view',
    resource: 'api_documentation',
    action: 'view',
    description: 'ดู API Documentation',
  },
  { code: 'users:view', resource: 'users', action: 'view', description: 'ดูข้อมูล user' },
  { code: 'users:edit', resource: 'users', action: 'edit', description: 'แก้ไข user' },
  { code: 'roles:view', resource: 'roles', action: 'view', description: 'ดู role' },
  { code: 'roles:edit', resource: 'roles', action: 'edit', description: 'แก้ไข role' },
  { code: 'audit:view', resource: 'audit', action: 'view', description: 'ดู audit log' },
];

export const RBAC_MATRIX_V20260810_GRANTS: RolePermissionGrant[] = [
  { role: 'public_anonymous', permission: 'dashboard:view', scope: ALL },
  ...binaryGrant('public_anonymous', ['feedback:submit', ...commonReadOnlyBinaryPermissions]),

  { role: 'public_user', permission: 'dashboard:view', scope: ALL },
  ...binaryGrant('public_user', ['dashboard.alerts:view', 'feedback:submit', 'chat:view', 'chat:ask', ...commonReadOnlyBinaryPermissions]),

  ...dataGrant('factory_operator', OWN, [
    'dashboard:view',
    'dashboard.stats:view',
    'dashboard.stats:export',
    'factories:view',
    'factories:edit',
    'cems_wpms_requests:view',
    'cems_wpms_requests:edit',
    'kwp_forms:view',
    'kwp_forms:edit',
    'bod_cod_errors:view',
    'bod_cod_errors:edit',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('factory_operator', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:ask',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('diw_central', ALL, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('diw_central', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:ask',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('provincial_office', PROV, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('provincial_office', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:ask',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('industrial_estate', EST, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('industrial_estate', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:ask',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('erc_office', TYPE_88, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'cems_wpms_requests:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('erc_office', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:ask',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('monitoring_kpm', REG, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'factories:edit',
    'cems_wpms_requests:view',
    'cems_wpms_requests:edit',
    'cems_wpms_requests:approve',
    'cems_wpms_requests:direct_connect',
    'kwp_forms:view',
    'kwp_forms:edit',
    'kwp_forms:approve',
    'bod_cod_errors:view',
    'bod_cod_errors:edit',
    'bod_cod_errors:approve',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('monitoring_kpm', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:answer',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('monitoring_5_centers', REG, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'factories:edit',
    'cems_wpms_requests:view',
    'kwp_forms:view',
    'kwp_forms:edit',
    'kwp_forms:approve',
    'bod_cod_errors:view',
    'bod_cod_errors:edit',
    'bod_cod_errors:approve',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('monitoring_5_centers', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'chat:view',
    'chat:answer',
    ...commonReadOnlyBinaryPermissions,
  ]),

  ...dataGrant('center_director', REG, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'cems_wpms_requests:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'bod_cod_errors:approve',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('center_director', ['dashboard.alerts:view', 'helpdesk:submit', 'feedback:submit', ...commonReadOnlyBinaryPermissions]),

  ...dataGrant('kpm_director', REG, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'cems_wpms_requests:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'bod_cod_errors:approve',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('kpm_director', ['dashboard.alerts:view', 'helpdesk:submit', 'feedback:submit', ...commonReadOnlyBinaryPermissions]),

  ...dataGrant('kwp_director', ALL, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'cems_wpms_requests:view',
    'kwp_forms:view',
    'bod_cod_errors:view',
    'bod_cod_errors:approve',
    'notifications:view',
    'eligible_factories:view',
  ]),
  ...binaryGrant('kwp_director', ['dashboard.alerts:view', 'helpdesk:submit', 'feedback:submit', ...commonReadOnlyBinaryPermissions]),

  ...dataGrant('admin', ALL, [
    ...dashboardScopedPermissions,
    'statistics:view',
    'statistics:export',
    'conditional_search:view',
    'factories:view',
    'factories:edit',
    'factories:approve',
    'cems_wpms_requests:view',
    'cems_wpms_requests:edit',
    'cems_wpms_requests:approve',
    'cems_wpms_requests:direct_connect',
    'kwp_forms:view',
    'kwp_forms:edit',
    'kwp_forms:approve',
    'bod_cod_errors:view',
    'bod_cod_errors:edit',
    'bod_cod_errors:approve',
    'notifications:view',
    'notifications:view_status',
    'notifications:edit',
    'notifications:approve',
    'eligible_factories:view',
    'eligible_factories:edit',
    'eligible_factories:approve',
  ]),
  ...binaryGrant('admin', [
    'dashboard.alerts:view',
    'helpdesk:submit',
    'feedback:submit',
    'laws:view',
    'laws:edit',
    'faq:view',
    'faq:edit',
    'chat:view',
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
  ]),
];
