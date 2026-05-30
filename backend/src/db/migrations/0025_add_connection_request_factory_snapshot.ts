import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.specificType('industry_main_order', 'NVARCHAR(128) NULL');
    table.specificType('industry_sub_order', 'NVARCHAR(128) NULL');
    table.specificType('business_activity', 'NVARCHAR(MAX) NULL');
    table.boolean('has_eia').nullable();
    table.specificType('project_name', 'NVARCHAR(500) NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('officer_notification_emails_json', 'NVARCHAR(MAX) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.dropColumn('officer_notification_emails_json');
    table.dropColumn('address');
    table.dropColumn('project_name');
    table.dropColumn('has_eia');
    table.dropColumn('business_activity');
    table.dropColumn('industry_sub_order');
    table.dropColumn('industry_main_order');
  });
}
