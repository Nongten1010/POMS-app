import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      DROP INDEX uq_device_connection_configs_station
      ON device_connection_configs;
    END
  `);

  const hasDeviceCode = await knex.schema.hasColumn('device_connection_configs', 'device_code');
  if (!hasDeviceCode) {
    await knex.schema.alterTable('device_connection_configs', (table) => {
      table.specificType('device_code', 'VARCHAR(64) NULL');
    });
  }

  const hasParameterStatus = await knex.schema.hasColumn(
    'device_measurement_channels',
    'parameter_status',
  );
  if (!hasParameterStatus) {
    await knex.schema.alterTable('device_measurement_channels', (table) => {
      table.specificType('parameter_status', 'VARCHAR(64) NULL');
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station_protocol'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_device_connection_configs_station_protocol
      ON device_connection_configs(station_id, protocol)
      WHERE deleted_at IS NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station_protocol'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      DROP INDEX uq_device_connection_configs_station_protocol
      ON device_connection_configs;
    END
  `);

  const hasParameterStatus = await knex.schema.hasColumn(
    'device_measurement_channels',
    'parameter_status',
  );
  if (hasParameterStatus) {
    await knex.schema.alterTable('device_measurement_channels', (table) => {
      table.dropColumn('parameter_status');
    });
  }

  const hasDeviceCode = await knex.schema.hasColumn('device_connection_configs', 'device_code');
  if (hasDeviceCode) {
    await knex.schema.alterTable('device_connection_configs', (table) => {
      table.dropColumn('device_code');
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_device_connection_configs_station
      ON device_connection_configs(station_id)
      WHERE deleted_at IS NULL;
    END
  `);
}
