import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('poms_factory_edit_requests', (table) => {
    table.text('target_measurement_point_ids_json', 'nvarchar(max)').nullable();
  });
  // NULL means legacy/unknown. Never backfill submitted IDs from full-factory snapshots.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('poms_factory_edit_requests', (table) => {
    table.dropColumn('target_measurement_point_ids_json');
  });
}
