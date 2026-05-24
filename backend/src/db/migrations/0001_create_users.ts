import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('external_id', 'VARCHAR(32) NOT NULL');
    table.specificType('identity_provider', 'VARCHAR(32) NOT NULL');
    table.specificType('user_type', 'VARCHAR(16) NOT NULL');
    table.string('username', 64).nullable();
    table.string('email', 255).nullable();
    table.specificType('phone', 'VARCHAR(32) NULL');
    table.string('prename_th', 16).nullable();
    table.string('first_name', 128).notNullable();
    table.string('last_name', 128).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.specificType('password_hash', 'VARBINARY(256) NULL');
    table.specificType('last_login_at', 'DATETIME2 NULL');
    table.specificType('last_synced_at', 'DATETIME2 NULL');
    addAuditColumns(table);
    table.unique(['identity_provider', 'external_id'], { indexName: 'uq_users_provider' });
  });

  await knex.schema.raw(`
    CREATE INDEX ix_users_username ON users(username) WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`CREATE INDEX ix_users_user_type ON users(user_type);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
