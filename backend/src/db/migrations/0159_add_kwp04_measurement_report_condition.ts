import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('kwp_emission_measurement_items', (table) => {
    table.specificType('report_condition', 'VARCHAR(5) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  const populated = await knex('kwp_emission_measurement_items')
    .whereNotNull('report_condition')
    .first('id');
  if (populated)
    throw new Error('Cannot remove report_condition while measurement items contain data');
  await knex.schema.alterTable('kwp_emission_measurement_items', (table) => {
    table.dropColumn('report_condition');
  });
}
