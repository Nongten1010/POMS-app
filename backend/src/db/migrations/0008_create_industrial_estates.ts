import type { Knex } from 'knex';
import { addTimestamps, addSoftDelete } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('industrial_estates', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('code', 'VARCHAR(16) NOT NULL');
    table.string('name_th', 255).notNullable();
    table.string('name_en', 255).nullable();
    table.specificType('province_id', 'VARCHAR(8) NOT NULL');
    table.boolean('is_active').notNullable().defaultTo(true);
    addTimestamps(table);
    addSoftDelete(table);
    table.unique(['code'], { indexName: 'uq_estate_code' });
    table
      .foreign('province_id', 'fk_estate_province')
      .references('id')
      .inTable('provinces');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('industrial_estates');
}
