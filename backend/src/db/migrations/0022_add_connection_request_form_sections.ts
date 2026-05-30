import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_measurement_points', (table) => {
    table.specificType('details_json', 'NVARCHAR(MAX) NULL');
    table.specificType('documents_json', 'NVARCHAR(MAX) NULL');
    table.specificType('instruments_json', 'NVARCHAR(MAX) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_measurement_points', (table) => {
    table.dropColumn('instruments_json');
    table.dropColumn('documents_json');
    table.dropColumn('details_json');
  });
}
