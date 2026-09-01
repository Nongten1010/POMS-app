import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DELETE rp
    FROM role_permissions AS rp
    INNER JOIN permissions AS p ON p.id = rp.permission_id
    INNER JOIN roles AS r ON r.id = rp.role_id
    WHERE p.code = 'factories:approve'
      AND r.code <> 'admin';
  `);
}

export async function down(_knex: Knex): Promise<void> {}
