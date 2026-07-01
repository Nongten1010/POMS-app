import type { Knex } from 'knex';

const FACTORY_OPERATOR_ROLE = 'factory_operator';
const STATISTICS_PERMISSION = 'dashboard.stats:view';
const OPERATOR_SCOPE = 'OWN_FACTORY';

type IdRow = { id: number };

export async function up(knex: Knex): Promise<void> {
  const factoryOperatorRoles = knex('roles').select('id').where({ code: FACTORY_OPERATOR_ROLE });
  const statisticsPermissions = knex('permissions')
    .select('id')
    .where({ code: STATISTICS_PERMISSION });

  await knex('role_permissions')
    .whereIn('role_id', factoryOperatorRoles)
    .whereIn('permission_id', statisticsPermissions)
    .del();

  await knex('user_permissions')
    .where('effect', 'allow')
    .whereIn('permission_id', statisticsPermissions)
    .whereIn(
      'user_id',
      knex('user_roles')
        .select('user_roles.user_id')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('roles.code', FACTORY_OPERATOR_ROLE),
    )
    .del();
}

export async function down(knex: Knex): Promise<void> {
  const role = await knex<IdRow>('roles').where({ code: FACTORY_OPERATOR_ROLE }).first('id');
  const permission = await knex<IdRow>('permissions')
    .where({ code: STATISTICS_PERMISSION })
    .first('id');

  if (!role || !permission) return;

  const existingGrant = await knex('role_permissions')
    .where({
      role_id: role.id,
      permission_id: permission.id,
    })
    .first('role_id');

  if (existingGrant) return;

  await knex('role_permissions').insert({
    role_id: role.id,
    permission_id: permission.id,
    scope: OPERATOR_SCOPE,
  });
}
