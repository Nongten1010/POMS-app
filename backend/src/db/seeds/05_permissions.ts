import type { Knex } from 'knex';

export const PERMISSIONS: Array<{
  code: string;
  resource: string;
  action: string;
  description: string;
}> = [
  // dashboard
  {
    code: 'dashboard:view',
    resource: 'dashboard',
    action: 'view',
    description: 'ดู dashboard หน้าหลัก',
  },
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

  // factories
  {
    code: 'factories:view',
    resource: 'factories',
    action: 'view',
    description: 'ดูข้อมูลพื้นฐานโรงงาน',
  },
  {
    code: 'factories:edit',
    resource: 'factories',
    action: 'edit',
    description: 'แก้ไขข้อมูลพื้นฐานโรงงาน',
  },
  {
    code: 'factories:approve',
    resource: 'factories',
    action: 'approve',
    description: 'อนุมัติข้อมูลพื้นฐานโรงงาน',
  },

  // CEMS/WPMS connection requests
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

  // KWP forms (กวภ. 01-05)
  {
    code: 'kwp_forms:view',
    resource: 'kwp_forms',
    action: 'view',
    description: 'ดูแบบ กวภ. 01-05',
  },
  {
    code: 'kwp_forms:edit',
    resource: 'kwp_forms',
    action: 'edit',
    description: 'แก้ไขแบบ กวภ. 01-05',
  },
  {
    code: 'kwp_forms:approve',
    resource: 'kwp_forms',
    action: 'approve',
    description: 'อนุมัติแบบ กวภ. 01-05',
  },

  // BOD/COD errors
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

  // Notifications
  {
    code: 'notifications:view',
    resource: 'notifications',
    action: 'view',
    description: 'ดูการแจ้งเตือน',
  },
  {
    code: 'notifications:view_status',
    resource: 'notifications',
    action: 'view_status',
    description: 'ดูสถานะการแจ้งเตือน',
  },
  {
    code: 'notifications:edit',
    resource: 'notifications',
    action: 'edit',
    description: 'แก้ไขการแจ้งเตือน',
  },
  {
    code: 'notifications:approve',
    resource: 'notifications',
    action: 'approve',
    description: 'อนุมัติการแจ้งเตือน',
  },

  // Helpdesk + feedback
  {
    code: 'helpdesk:submit',
    resource: 'helpdesk',
    action: 'submit',
    description: 'แจ้งขอความช่วยเหลือ',
  },
  { code: 'feedback:submit', resource: 'feedback', action: 'submit', description: 'ส่งข้อเสนอแนะ' },

  // Laws + FAQ
  { code: 'laws:view', resource: 'laws', action: 'view', description: 'ดูกฎหมายที่เกี่ยวข้อง' },
  { code: 'laws:edit', resource: 'laws', action: 'edit', description: 'แก้ไขกฎหมายที่เกี่ยวข้อง' },
  { code: 'faq:view', resource: 'faq', action: 'view', description: 'ดูคำถามที่พบบ่อย' },
  { code: 'faq:edit', resource: 'faq', action: 'edit', description: 'แก้ไขคำถามที่พบบ่อย' },

  // Chat
  { code: 'chat:ask', resource: 'chat', action: 'ask', description: 'ถามคำถามใน chat' },
  { code: 'chat:answer', resource: 'chat', action: 'answer', description: 'ตอบคำถามใน chat' },

  // Admin
  {
    code: 'permissions:manage',
    resource: 'permissions',
    action: 'manage',
    description: 'จัดการสิทธิ์การใช้งาน',
  },
  {
    code: 'eligible_factories:manage',
    resource: 'eligible_factories',
    action: 'manage',
    description: 'จัดการโรงงานที่เข้าข่าย',
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

export async function seed(knex: Knex): Promise<void> {
  for (const perm of PERMISSIONS) {
    const existing = await knex('permissions').where({ code: perm.code }).first('id');
    if (existing) {
      await knex('permissions').where({ id: existing.id }).update({
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      });
    } else {
      await knex('permissions').insert(perm);
    }
  }
}
