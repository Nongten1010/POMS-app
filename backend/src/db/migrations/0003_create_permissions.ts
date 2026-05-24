import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('permissions', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('code', 'VARCHAR(64) NOT NULL');
    table.specificType('resource', 'VARCHAR(32) NOT NULL');
    table.specificType('action', 'VARCHAR(16) NOT NULL');
    table.string('description', 255).nullable();
    table.unique(['code'], { indexName: 'uq_permissions_code' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('permissions');
}
