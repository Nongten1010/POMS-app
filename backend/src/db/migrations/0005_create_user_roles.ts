import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_roles', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('role_id').notNullable();
    table.specificType('assigned_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.bigInteger('assigned_by').nullable();
    table.primary(['user_id', 'role_id'], { constraintName: 'pk_user_roles' });
    table
      .foreign('user_id', 'fk_ur_user')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .foreign('role_id', 'fk_ur_role')
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_roles');
}
