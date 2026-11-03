import type { Knex } from 'knex';

export const config = { transaction: true };

/** A passive archive, deliberately unrelated to alert_events and the email outbox. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('integration_alert_receipts', (table) => {
    table.uuid('receipt_id').primary();
    table.specificType('received_at', 'DATETIME2 NOT NULL');
    table.integer('event_count').notNullable();
    table.specificType('payload_json', 'NVARCHAR(MAX) NOT NULL');
    table.index(['received_at'], 'ix_integration_alert_receipts_received');
    table.check('event_count BETWEEN 1 AND 500', [], 'ck_integration_alert_receipts_count');
    table.check('ISJSON(payload_json) = 1', [], 'ck_integration_alert_receipts_json');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('integration_alert_receipts');
}
