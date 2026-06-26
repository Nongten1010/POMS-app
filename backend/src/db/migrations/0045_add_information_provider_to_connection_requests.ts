import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.specificType('information_provider_name', 'NVARCHAR(255) NULL');
    table.specificType('information_provider_position', 'NVARCHAR(255) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.dropColumn('information_provider_position');
    table.dropColumn('information_provider_name');
  });
}
