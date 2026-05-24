import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('role_permissions', (table) => {
    table.bigInteger('role_id').notNullable();
    table.bigInteger('permission_id').notNullable();
    table.specificType('scope', 'VARCHAR(16) NULL');
    table.specificType('granted_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.primary(['role_id', 'permission_id'], { constraintName: 'pk_role_permissions' });
    table
      .foreign('role_id', 'fk_rp_role')
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table
      .foreign('permission_id', 'fk_rp_permission')
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('role_permissions');
}
