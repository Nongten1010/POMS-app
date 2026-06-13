import type { Knex } from 'knex';
import { addTimestamps } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alert_events', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('alert_type', 'VARCHAR(64) NOT NULL');
    table.specificType('system_type', 'VARCHAR(16) NOT NULL');
    table.specificType('display_system_type', 'VARCHAR(32) NOT NULL');
    table.specificType('factory_id', 'VARCHAR(64) NULL');
    table.specificType('factory_name', 'NVARCHAR(500) NOT NULL');
    table.specificType('factory_registration_no', 'NVARCHAR(64) NULL');
    table.bigInteger('connected_measurement_point_id').nullable();
    table.specificType('station_id', 'VARCHAR(64) NOT NULL');
    table.specificType('point_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('point_type', 'VARCHAR(32) NULL');
    table.specificType('parameter_code', 'VARCHAR(64) NOT NULL');
    table.specificType('parameter_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('parameter_label', 'NVARCHAR(255) NOT NULL');
    table.specificType('unit', 'NVARCHAR(64) NULL');
    table.specificType('event_date', 'DATE NOT NULL');
    table.specificType('started_at', 'DATETIME2 NULL');
    table.specificType('ended_at', 'DATETIME2 NULL');
    table.decimal('measured_value', 18, 6).nullable();
    table.decimal('threshold_value', 18, 6).nullable();
    table.specificType('threshold_type', 'VARCHAR(32) NULL');
    table.decimal('completeness_percent', 5, 2).nullable();
    table.integer('consecutive_days').nullable();
    table.specificType('abnormal_type', 'VARCHAR(32) NULL');
    table.integer('abnormal_streak_count').nullable();
    table.specificType('first_abnormal_at', 'DATETIME2 NULL');
    table.specificType('confirmed_abnormal_at', 'DATETIME2 NULL');
    table.specificType('source_table', 'VARCHAR(128) NULL');
    table.specificType('source_interval', "VARCHAR(16) NOT NULL DEFAULT '60m'");
    table.specificType('source_payload_json', 'NVARCHAR(MAX) NULL');
    table.specificType('evidence_json', 'NVARCHAR(MAX) NULL');
    table.specificType('notification_status', "VARCHAR(32) NOT NULL DEFAULT 'AUTO'");
    table.specificType('idempotency_key', 'VARCHAR(220) NOT NULL');
    table.specificType('detected_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    addTimestamps(table);
    table.bigInteger('created_by').nullable();
    table.bigInteger('updated_by').nullable();
    table.specificType('deleted_at', 'DATETIME2 NULL');
  });

  await knex.schema.createTable('alert_notifications', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('alert_event_id').notNullable();
    table.specificType('channel', 'VARCHAR(32) NOT NULL');
    table.specificType('recipient', 'NVARCHAR(255) NULL');
    table.specificType('send_status', 'VARCHAR(32) NOT NULL');
    table.specificType('error_message', 'NVARCHAR(1000) NULL');
    table.specificType('sent_at', 'DATETIME2 NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('alert_event_id', 'fk_alert_notifications_event')
      .references('id')
      .inTable('alert_events');
  });

  await knex.schema.createTable('measurement_daily_summaries', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('system_type', 'VARCHAR(16) NOT NULL');
    table.specificType('factory_id', 'VARCHAR(64) NULL');
    table.specificType('station_id', 'VARCHAR(64) NOT NULL');
    table.specificType('parameter_code', 'VARCHAR(64) NOT NULL');
    table.specificType('parameter_label', 'NVARCHAR(255) NOT NULL');
    table.specificType('unit', 'NVARCHAR(64) NULL');
    table.specificType('summary_date', 'DATE NOT NULL');
    table.integer('expected_count').notNullable();
    table.integer('received_count').notNullable();
    table.integer('normal_status_count').notNullable().defaultTo(0);
    table.integer('shutdown_status_count').notNullable().defaultTo(0);
    table.decimal('completeness_percent', 5, 2).notNullable();
    table.integer('null_count').notNullable().defaultTo(0);
    table.integer('zero_count').notNullable().defaultTo(0);
    table.integer('negative_count').notNullable().defaultTo(0);
    table.integer('same_value_max_streak').notNullable().defaultTo(0);
    table.specificType('first_received_at', 'DATETIME2 NULL');
    table.specificType('last_received_at', 'DATETIME2 NULL');
    table.specificType('source_table', 'VARCHAR(128) NULL');
    addTimestamps(table);
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_alert_events_idempotency
    ON alert_events(idempotency_key)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_alert_events_date_type
    ON alert_events(event_date DESC, alert_type, system_type)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_alert_events_factory_date
    ON alert_events(factory_id, event_date DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_alert_events_station_param_date
    ON alert_events(station_id, parameter_code, event_date DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_alert_notifications_event
    ON alert_notifications(alert_event_id, created_at DESC);
  `);
  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_daily_summary_station_param_date
    ON measurement_daily_summaries(station_id, parameter_code, summary_date);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('measurement_daily_summaries');
  await knex.schema.dropTableIfExists('alert_notifications');
  await knex.schema.dropTableIfExists('alert_events');
}
