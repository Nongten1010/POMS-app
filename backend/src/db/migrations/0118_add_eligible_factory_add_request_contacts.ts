import type { Knex } from 'knex';

const TABLE_NAME = 'eligible_factory_add_requests';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.specificType('contact_name', 'NVARCHAR(255) NULL');
    table.specificType('contact_phone', 'NVARCHAR(64) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumns('contact_name', 'contact_phone');
  });
}
