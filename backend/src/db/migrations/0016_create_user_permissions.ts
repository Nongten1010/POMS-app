import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_permissions', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('permission_id').notNullable();
    table.specificType('effect', 'VARCHAR(8) NOT NULL');
    table.specificType('scope', 'VARCHAR(16) NULL');
    table.specificType('granted_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.bigInteger('granted_by').nullable();
    table.primary(['user_id', 'permission_id'], { constraintName: 'pk_user_permissions' });
    table.foreign('user_id', 'fk_up_user').references('id').inTable('users').onDelete('CASCADE');
    table
      .foreign('permission_id', 'fk_up_permission')
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    table.foreign('granted_by', 'fk_up_granted_by').references('id').inTable('users');
  });

  await knex.schema.raw(`
    ALTER TABLE user_permissions
    ADD CONSTRAINT ck_user_permissions_effect CHECK (effect IN ('allow', 'deny'));
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_user_permissions_user ON user_permissions(user_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_permissions');
}
