import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('eligible_factories', (table) => {
    table.bigInteger('monitoring_point_form_id').nullable();
    table
      .foreign('monitoring_point_form_id', 'fk_eligible_factories_monitoring_point_form')
      .references('id')
      .inTable('factory_monitoring_point_forms');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_eligible_factories_monitoring_point_form
    ON eligible_factories(monitoring_point_form_id)
    WHERE deleted_at IS NULL AND monitoring_point_form_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX uq_eligible_factories_monitoring_point_form
    ON eligible_factories;
  `);

  await knex.schema.alterTable('eligible_factories', (table) => {
    table.dropForeign(['monitoring_point_form_id'], 'fk_eligible_factories_monitoring_point_form');
    table.dropColumn('monitoring_point_form_id');
  });
}
