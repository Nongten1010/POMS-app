import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bod_cod_approval_events', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('report_id').notNullable();
    table.specificType('action', 'VARCHAR(64) NOT NULL');
    table.bigInteger('actor_user_id').notNullable();
    table.specificType('note', 'NVARCHAR(1000) NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('report_id', 'fk_bodcod_event_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
    table.foreign('actor_user_id', 'fk_bodcod_event_actor').references('id').inTable('users');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_events_report
    ON bod_cod_approval_events(report_id, created_at, id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bod_cod_approval_events');
}
