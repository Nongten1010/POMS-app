import type { Knex } from 'knex';

export const ROLES = [
  { code: 'public_anonymous', name_th: 'ประชาชน ไม่ login', name_en: 'Public Anonymous' },
  { code: 'public_user', name_th: 'ประชาชน login', name_en: 'Public Logged-in' },
  { code: 'factory_operator', name_th: 'โรงงาน (ผู้ประกอบการ)', name_en: 'Factory Operator' },
  { code: 'diw_central', name_th: 'กรอ.', name_en: 'DIW Central' },
  { code: 'provincial_office', name_th: 'สอจ.', name_en: 'Provincial Industrial Office' },
  { code: 'industrial_estate', name_th: 'กนอ.', name_en: 'Industrial Estate Authority' },
  { code: 'monitoring_kpm', name_th: 'เจ้าหน้าที่ศูนย์เฝ้า (กฝม.)', name_en: 'Pollution Monitoring (KPM)' },
  { code: 'monitoring_5_centers', name_th: 'เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์)', name_en: 'Regional Centers (5)' },
  { code: 'center_director', name_th: 'ผอ.ศูนย์', name_en: 'Center Director' },
  { code: 'kpm_director', name_th: 'ผอ.กฝม.', name_en: 'KPM Director' },
  { code: 'kwp_director', name_th: 'ผอ.กวภ.', name_en: 'KWP Director' },
  { code: 'admin', name_th: 'Admin', name_en: 'Administrator' },
];

export async function seed(knex: Knex): Promise<void> {
  for (const role of ROLES) {
    const existing = await knex('roles').where({ code: role.code }).first('id');
    if (existing) {
      await knex('roles').where({ id: existing.id }).update({
        name_th: role.name_th,
        name_en: role.name_en,
        is_system: true,
        updated_at: knex.raw('SYSDATETIME()'),
      });
    } else {
      await knex('roles').insert({
        code: role.code,
        name_th: role.name_th,
        name_en: role.name_en,
        is_system: true,
      });
    }
  }
}
