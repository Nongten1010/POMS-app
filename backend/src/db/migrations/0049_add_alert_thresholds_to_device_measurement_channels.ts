import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasAlertLow = await knex.schema.hasColumn('device_measurement_channels', 'alert_low');
  const hasAlertHigh = await knex.schema.hasColumn('device_measurement_channels', 'alert_high');

  if (!hasAlertLow || !hasAlertHigh) {
    await knex.schema.alterTable('device_measurement_channels', (table) => {
      if (!hasAlertLow) table.decimal('alert_low', 18, 6).nullable();
      if (!hasAlertHigh) table.decimal('alert_high', 18, 6).nullable();
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'ck_device_measurement_channels_alert_range'
        AND parent_object_id = OBJECT_ID('device_measurement_channels')
    )
    BEGIN
      ALTER TABLE device_measurement_channels
      ADD CONSTRAINT ck_device_measurement_channels_alert_range
      CHECK (
        alert_low IS NULL OR
        alert_high IS NULL OR
        alert_low <= alert_high
      );
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'ck_device_measurement_channels_alert_range'
        AND parent_object_id = OBJECT_ID('device_measurement_channels')
    )
    BEGIN
      ALTER TABLE device_measurement_channels
      DROP CONSTRAINT ck_device_measurement_channels_alert_range;
    END
  `);

  const hasAlertHigh = await knex.schema.hasColumn('device_measurement_channels', 'alert_high');
  const hasAlertLow = await knex.schema.hasColumn('device_measurement_channels', 'alert_low');

  if (hasAlertHigh || hasAlertLow) {
    await knex.schema.alterTable('device_measurement_channels', (table) => {
      if (hasAlertHigh) table.dropColumn('alert_high');
      if (hasAlertLow) table.dropColumn('alert_low');
    });
  }
}
