import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX uq_device_connection_configs_station
    ON device_connection_configs;
  `);

  await knex.schema.alterTable('device_connection_configs', (table) => {
    table.specificType('device_code', 'VARCHAR(64) NULL');
  });

  await knex.schema.alterTable('device_measurement_channels', (table) => {
    table.specificType('parameter_status', 'VARCHAR(64) NULL');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_device_connection_configs_station_protocol
    ON device_connection_configs(station_id, protocol)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX uq_device_connection_configs_station_protocol
    ON device_connection_configs;
  `);

  await knex.schema.alterTable('device_measurement_channels', (table) => {
    table.dropColumn('parameter_status');
  });

  await knex.schema.alterTable('device_connection_configs', (table) => {
    table.dropColumn('device_code');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_device_connection_configs_station
    ON device_connection_configs(station_id)
    WHERE deleted_at IS NULL;
  `);
}
