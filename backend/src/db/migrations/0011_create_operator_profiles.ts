import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('operator_profiles', (table) => {
    table.bigInteger('user_id').notNullable().primary();
    table.specificType('user_code', 'VARCHAR(16) NULL');
    table.specificType('regis_date', 'DATETIME2 NULL');
    table.specificType('synced_at', 'DATETIME2 NULL');
    table
      .foreign('user_id', 'fk_operator_user')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('operator_profiles');
}
