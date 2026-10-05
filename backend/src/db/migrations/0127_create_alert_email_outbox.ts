import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alert_email_batches', (table) => {
    table.bigIncrements('id').primary();
    table.string('deduplication_key', 220).notNullable();
    table.string('cadence', 16).notNullable();
    table.string('alert_type', 64).notNullable();
    table.string('system_type', 16).nullable();
    table.specificType('scheduled_at', 'DATETIME2 NOT NULL');
    table.specificType('period_start', 'DATETIME2 NOT NULL');
    table.specificType('period_end', 'DATETIME2 NOT NULL');
    table.string('recipient', 255).notNullable();
    table.specificType('cc_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('subject', 'NVARCHAR(500) NOT NULL');
    table.specificType('text_body', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('html_body', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['deduplication_key'], { indexName: 'uq_alert_email_batches_deduplication' });
    table.check("cadence IN ('HOURLY', 'DAILY')", [], 'ck_alert_email_batches_cadence');
    table.check('period_end > period_start', [], 'ck_alert_email_batches_period');
  });

  await knex.schema.createTable('alert_email_batch_events', (table) => {
    table.bigInteger('batch_id').notNullable();
    table.bigInteger('alert_event_id').notNullable();
    table.string('recipient_key', 64).notNullable();
    table.unique(['batch_id', 'alert_event_id'], { indexName: 'uq_alert_email_batch_events' });
    table.unique(['alert_event_id', 'recipient_key'], {
      indexName: 'uq_alert_email_recipient_events',
    });
    table
      .foreign('batch_id', 'fk_alert_email_batch_events_batch')
      .references('id')
      .inTable('alert_email_batches');
    table
      .foreign('alert_event_id', 'fk_alert_email_batch_events_event')
      .references('id')
      .inTable('alert_events');
    table.index(['alert_event_id'], 'ix_alert_email_batch_events_event');
  });

  await knex.schema.createTable('alert_email_deliveries', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('batch_id').notNullable();
    table.string('status', 32).notNullable().defaultTo('QUEUED');
    table.integer('attempts').notNullable().defaultTo(0);
    table.specificType('next_attempt_at', 'DATETIME2 NULL');
    table.specificType('leased_until', 'DATETIME2 NULL');
    table.string('lease_token', 36).nullable();
    table.specificType('message_id', 'NVARCHAR(500) NULL');
    table.specificType('accepted_recipients_json', 'NVARCHAR(MAX) NULL');
    table.specificType('rejected_recipients_json', 'NVARCHAR(MAX) NULL');
    table.string('error_code', 64).nullable();
    table.specificType('completed_at', 'DATETIME2 NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['batch_id'], { indexName: 'uq_alert_email_deliveries_batch' });
    table
      .foreign('batch_id', 'fk_alert_email_deliveries_batch')
      .references('id')
      .inTable('alert_email_batches');
    table.index(['status', 'next_attempt_at', 'id'], 'ix_alert_email_deliveries_due');
    table.index(['status', 'leased_until'], 'ix_alert_email_deliveries_expired_lease');
    table.check(
      "status IN ('QUEUED', 'PROCESSING', 'SMTP_ACCEPTED', 'RETRY_PENDING', 'FAILED', 'UNKNOWN', 'SKIPPED')",
      [],
      'ck_alert_email_deliveries_status',
    );
    table.check('attempts >= 0 AND attempts <= 5', [], 'ck_alert_email_deliveries_attempts');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alert_email_deliveries');
  await knex.schema.dropTableIfExists('alert_email_batch_events');
  await knex.schema.dropTableIfExists('alert_email_batches');
}
