import type { Knex } from 'knex';

const TABLE_NAME = 'factory_monitoring_point_forms';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.specificType('eia_other', 'NVARCHAR(500) NULL');
    table.specificType('project_name', 'NVARCHAR(500) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn('project_name');
    table.dropColumn('eia_other');
  });
}
