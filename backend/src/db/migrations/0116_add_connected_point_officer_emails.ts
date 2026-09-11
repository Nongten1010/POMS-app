import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connected_measurement_points', (table) => {
    // NULL inherits the source request; [] is an explicitly cleared recipient list.
    table.text('officer_notification_emails_json', 'nvarchar(max)').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connected_measurement_points', (table) => {
    table.dropColumn('officer_notification_emails_json');
  });
}
