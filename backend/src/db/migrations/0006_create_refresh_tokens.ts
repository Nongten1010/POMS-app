import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').notNullable();
    table.specificType('token_hash', 'VARBINARY(32) NOT NULL');
    table.specificType('family_id', 'UNIQUEIDENTIFIER NOT NULL');
    table.specificType('expires_at', 'DATETIME2 NOT NULL');
    table.specificType('revoked_at', 'DATETIME2 NULL');
    table.bigInteger('rotated_from_id').nullable();
    table.string('user_agent', 500).nullable();
    table.specificType('ip_address', 'VARCHAR(45) NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('user_id', 'fk_rt_user')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });

  await knex.schema.raw(`CREATE UNIQUE INDEX ix_rt_hash ON refresh_tokens(token_hash);`);
  await knex.schema.raw(`
    CREATE INDEX ix_rt_user_active ON refresh_tokens(user_id, expires_at)
    WHERE revoked_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
}
