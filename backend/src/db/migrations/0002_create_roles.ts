import type { Knex } from 'knex';
import { addTimestamps, addSoftDelete } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('roles', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('code', 'VARCHAR(32) NOT NULL');
    table.string('name_th', 128).notNullable();
    table.string('name_en', 128).notNullable();
    table.string('description', 500).nullable();
    table.boolean('is_system').notNullable().defaultTo(false);
    addTimestamps(table);
    addSoftDelete(table);
    table.unique(['code'], { indexName: 'uq_roles_code' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('roles');
}
