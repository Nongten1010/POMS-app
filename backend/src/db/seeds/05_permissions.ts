import type { Knex } from 'knex';
import { RBAC_MATRIX_V20260810_PERMISSIONS as PERMISSIONS } from './rbac_matrix_v20260810';

export { PERMISSIONS };

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
