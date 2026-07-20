import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.specificType('organize_name_th', 'NVARCHAR(255) NULL');
    table.specificType('division_name_th', 'NVARCHAR(255) NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.dropColumn('division_name_th');
    table.dropColumn('organize_name_th');
  });
}
