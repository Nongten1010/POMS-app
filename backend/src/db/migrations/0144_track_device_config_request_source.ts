import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('device_connection_configs', (table) => {
    // Existing rows have unknown provenance. Never guess an origin from matching settings.
    table.bigInteger('source_request_id').nullable();
    table.boolean('source_recorded').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('device_connection_configs', (table) => {
    table.dropColumn('source_request_id');
    table.dropColumn('source_recorded');
  });
}
