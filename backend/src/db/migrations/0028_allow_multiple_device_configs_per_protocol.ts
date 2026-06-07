import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
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

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station_protocol_device'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_device_connection_configs_station_protocol_device
      ON device_connection_configs(station_id, protocol, device_code)
      WHERE deleted_at IS NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_station_protocol_device'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      DROP INDEX uq_device_connection_configs_station_protocol_device
      ON device_connection_configs;
    END
  `);

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
