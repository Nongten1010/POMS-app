import type { Knex } from 'knex';
import { MOCK_OPERATORS } from '../../modules/auth/fixtures/mock-users';

export async function seed(knex: Knex): Promise<void> {
  for (const op of MOCK_OPERATORS) {
    const user = await knex('users')
      .where({ identity_provider: 'mock', external_id: op.citizen_id })
      .first('id');
    if (!user) continue;

    for (const jur of op.juristics) {
      const juristic = await knex('juristics')
        .where({ juristic_id: jur.juristic_id })
        .first('id');
      if (!juristic) continue;

      const exists = await knex('user_juristics')
        .where({ user_id: user.id, juristic_id: juristic.id })
        .first();
      if (!exists) {
        await knex('user_juristics').insert({ user_id: user.id, juristic_id: juristic.id });
      }
    }
  }
}
