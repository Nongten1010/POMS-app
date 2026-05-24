import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('provinces', (table) => {
    table.specificType('id', 'VARCHAR(8) NOT NULL').primary();
    table.string('name_th', 64).notNullable();
    table.string('name_en', 64).notNullable();
    table.string('region', 32).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('provinces');
}
