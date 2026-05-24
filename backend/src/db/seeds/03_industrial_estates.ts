import type { Knex } from 'knex';

const ESTATES = [
  { code: 'IE01', name_th: 'นิคมอุตสาหกรรมมาบตาพุด', province_id: '1021' },
  { code: 'IE02', name_th: 'นิคมอุตสาหกรรมอมตะนคร', province_id: '1020' },
  { code: 'IE03', name_th: 'นิคมอุตสาหกรรมบางปู', province_id: '1011' },
  { code: 'IE04', name_th: 'นิคมอุตสาหกรรมเหมราชอีสเทิร์นซีบอร์ด', province_id: '1021' },
  { code: 'IE05', name_th: 'นิคมอุตสาหกรรมสหรัตนนคร', province_id: '1014' },
];

export async function seed(knex: Knex): Promise<void> {
  for (const e of ESTATES) {
    const exists = await knex('industrial_estates').where({ code: e.code }).first('id');
    if (exists) {
      await knex('industrial_estates').where({ id: exists.id }).update({
        name_th: e.name_th,
        province_id: e.province_id,
        is_active: true,
        updated_at: knex.raw('SYSDATETIME()'),
      });
    } else {
      await knex('industrial_estates').insert({ ...e, is_active: true });
    }
  }
}
