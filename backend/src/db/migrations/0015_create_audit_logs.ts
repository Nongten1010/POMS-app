import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('actor_user_id').nullable();
    table.specificType('action', 'VARCHAR(64) NOT NULL');
    table.specificType('target_type', 'VARCHAR(32) NULL');
    table.bigInteger('target_id').nullable();
    table.specificType('metadata', 'NVARCHAR(MAX) NULL');
    table.specificType('ip_address', 'VARCHAR(45) NULL');
    table.string('user_agent', 500).nullable();
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('actor_user_id', 'fk_audit_actor')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_audit_actor ON audit_logs(actor_user_id, created_at DESC);
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_audit_target ON audit_logs(target_type, target_id, created_at DESC);
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_audit_action ON audit_logs(action, created_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
