import type { Knex } from 'knex';
import { MOCK_OPERATORS } from '../../modules/auth/fixtures/mock-users';

export async function seed(knex: Knex): Promise<void> {
  for (const op of MOCK_OPERATORS) {
    for (const jur of op.juristics) {
      const juristic = await knex('juristics')
        .where({ juristic_id: jur.juristic_id })
        .first('id');
      if (!juristic) continue;

      for (const f of jur.factories) {
        const existing = await knex('factories').where({ fid: f.fid }).first();
        const payload = {
          code: f.code,
          name: f.name,
          juristic_id: juristic.id,
          province_id: f.province_id,
          system_id: f.system_id,
          verify_status: f.verify_status,
          authorize_start: f.authorize_start,
          authorize_end: f.authorize_end,
          juristic_start: f.juristic_start,
          verify_date: f.verify_date,
          is_active: true,
        };
        if (existing) {
          await knex('factories').where({ id: existing.id }).update({
            ...payload,
            updated_at: knex.raw('SYSDATETIME()'),
          });
        } else {
          await knex('factories').insert({ fid: f.fid, ...payload });
        }
      }
    }
  }
}
