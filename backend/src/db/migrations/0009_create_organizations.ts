import type { Knex } from 'knex';
import { addTimestamps, addSoftDelete } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('organizations', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('external_id', 'VARCHAR(16) NOT NULL');
    table.bigInteger('parent_id').nullable();
    table.specificType('level', 'VARCHAR(16) NOT NULL');
    table.string('name_th', 255).notNullable();
    table.string('name_en', 255).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    addTimestamps(table);
    addSoftDelete(table);
    table.unique(['external_id', 'level'], { indexName: 'uq_org_external' });
    table
      .foreign('parent_id', 'fk_org_parent')
      .references('id')
      .inTable('organizations');
  });

  await knex.schema.raw(`CREATE INDEX ix_org_parent ON organizations(parent_id);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('organizations');
}
