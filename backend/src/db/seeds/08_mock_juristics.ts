import type { Knex } from 'knex';
import { MOCK_OPERATORS } from '../../modules/auth/fixtures/mock-users';

export async function seed(knex: Knex): Promise<void> {
  for (const op of MOCK_OPERATORS) {
    for (const jur of op.juristics) {
      const existing = await knex('juristics').where({ juristic_id: jur.juristic_id }).first();
      if (existing) {
        await knex('juristics').where({ id: existing.id }).update({
          name_th: jur.name_th,
          name_en: jur.name_en,
          updated_at: knex.raw('SYSDATETIME()'),
        });
      } else {
        await knex('juristics').insert({
          juristic_id: jur.juristic_id,
          name_th: jur.name_th,
          name_en: jur.name_en,
        });
      }
    }
  }
}
