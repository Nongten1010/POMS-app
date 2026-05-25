import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.string('department_name_th', 255).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('officer_profiles', (table) => {
    table.dropColumn('department_name_th');
  });
}
