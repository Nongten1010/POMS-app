import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.specificType('contact_persons_json', 'NVARCHAR(MAX) NULL');
    table.specificType('notification_emails_json', 'NVARCHAR(MAX) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.dropColumn('notification_emails_json');
    table.dropColumn('contact_persons_json');
  });
}
