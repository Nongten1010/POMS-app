import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('factory_monitoring_points', (table) => {
    table.specificType('primary_fuel_other', 'NVARCHAR(255) NULL');
    table.specificType('secondary_fuel_other', 'NVARCHAR(255) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('factory_monitoring_points', (table) => {
    table.dropColumn('secondary_fuel_other');
    table.dropColumn('primary_fuel_other');
  });
}
