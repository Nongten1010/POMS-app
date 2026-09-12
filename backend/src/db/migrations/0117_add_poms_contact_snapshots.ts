import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connected_measurement_points', (table) => {
    table.text('contact_persons_json', 'nvarchar(max)').nullable();
    table.text('notification_emails_json', 'nvarchar(max)').nullable();
  });
  await knex.schema.alterTable('poms_factory_edit_requests', (table) => {
    table.text('current_contacts_json', 'nvarchar(max)').nullable();
    table.text('proposed_contacts_json', 'nvarchar(max)').nullable();
  });
  // Historical requests intentionally remain null: current source data is not an audit snapshot.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('poms_factory_edit_requests', (table) => {
    table.dropColumn('current_contacts_json');
    table.dropColumn('proposed_contacts_json');
  });
  await knex.schema.alterTable('cems_wpms_connected_measurement_points', (table) => {
    table.dropColumn('contact_persons_json');
    table.dropColumn('notification_emails_json');
  });
}
