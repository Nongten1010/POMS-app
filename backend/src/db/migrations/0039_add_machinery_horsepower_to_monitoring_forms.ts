import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('factory_monitoring_point_forms', (table) => {
    table.decimal('machinery_horsepower', 18, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('factory_monitoring_point_forms', (table) => {
    table.dropColumn('machinery_horsepower');
  });
}
