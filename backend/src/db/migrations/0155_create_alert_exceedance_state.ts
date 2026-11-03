import type { Knex } from 'knex';

export const config = { transaction: true };

/** Follows production migration 0154; never alters the externally populated 60m tables. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alert_exceedance_lease', (table) => {
    table.string('lease_key', 32).primary();
    table.string('owner', 36).nullable();
    table.bigInteger('fence').notNullable().defaultTo(0);
    table.specificType('expires_at', 'DATETIME2 NOT NULL');
    table.bigInteger('scan_after_id').notNullable().defaultTo(0);
  });
  await knex.schema.createTable('alert_exceedance_points', (table) => {
    table.string('mode', 8).notNullable();
    table.string('system_type', 16).notNullable();
    table.string('station_id', 64).notNullable();
    table.string('fingerprint', 64).notNullable();
    table.specificType('valid_from', 'DATETIME2 NOT NULL');
    table.specificType('next_hour', 'DATETIME2 NOT NULL');
    table.primary(['mode', 'system_type', 'station_id']);
  });
  await knex.schema.createTable('alert_exceedance_hours', (table) => {
    table.string('mode', 8).notNullable();
    table.string('system_type', 16).notNullable();
    table.string('station_id', 64).notNullable();
    table.specificType('hour_at', 'DATETIME2 NOT NULL');
    table.string('fingerprint', 64).notNullable();
    table.string('status', 24).notNullable();
    table.integer('attempts').notNullable().defaultTo(0);
    table.specificType('next_retry_at', 'DATETIME2 NULL');
    table.specificType('checked_at', 'DATETIME2 NOT NULL');
    table.specificType('summary_json', 'NVARCHAR(MAX) NOT NULL');
    table.primary(['mode', 'system_type', 'station_id', 'hour_at']);
    table.index(
      ['mode', 'system_type', 'station_id', 'next_retry_at'],
      'ix_alert_exceedance_retry',
    );
    table.index(['mode', 'status', 'checked_at'], 'ix_alert_exceedance_retention');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alert_exceedance_hours');
  await knex.schema.dropTableIfExists('alert_exceedance_points');
  await knex.schema.dropTableIfExists('alert_exceedance_lease');
}
