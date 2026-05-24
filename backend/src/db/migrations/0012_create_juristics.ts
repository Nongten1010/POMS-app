import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('juristics', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('juristic_id', 'VARCHAR(13) NOT NULL');
    table.string('name_th', 500).notNullable();
    table.string('name_en', 500).nullable();
    addAuditColumns(table);
    table.unique(['juristic_id'], { indexName: 'uq_juristic_id' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('juristics');
}
