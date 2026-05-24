import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_juristics', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('juristic_id').notNullable();
    table.specificType('granted_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.specificType('revoked_at', 'DATETIME2 NULL');
    table.primary(['user_id', 'juristic_id'], { constraintName: 'pk_user_juristics' });
    table
      .foreign('user_id', 'fk_uj_user')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .foreign('juristic_id', 'fk_uj_juristic')
      .references('id')
      .inTable('juristics');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_juristics');
}
