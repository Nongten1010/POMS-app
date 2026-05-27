import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('device_connection_configs', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('station_id', 'VARCHAR(64) NOT NULL');
    table.specificType('protocol', 'VARCHAR(32) NOT NULL');
    table.specificType('settings_json', 'NVARCHAR(MAX) NOT NULL');
    addAuditColumns(table);
  });

  await knex.schema.createTable('device_measurement_channels', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('config_id').notNullable();
    table.bigInteger('address_id').notNullable();
    table.specificType('data_type', 'NVARCHAR(128) NOT NULL');
    table.specificType('unit', 'NVARCHAR(64) NOT NULL');
    table.specificType('value_range_json', 'NVARCHAR(MAX) NULL');
    table.specificType('value_format', 'VARCHAR(32) NULL');
    table.decimal('offset_value', 18, 6).notNullable().defaultTo(0);
    table.specificType('encoding', 'VARCHAR(64) NULL');
    addAuditColumns(table);
    table
      .foreign('config_id', 'fk_device_measurement_channel_config')
      .references('id')
      .inTable('device_connection_configs');
    table.unique(['config_id', 'address_id'], {
      indexName: 'uq_device_measurement_channels_config_address',
    });
  });

  await knex.schema.raw(`
    CREATE INDEX ix_device_connection_configs_station
    ON device_connection_configs(station_id, protocol)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_device_measurement_channels_config
    ON device_measurement_channels(config_id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE device_connection_configs
    ADD CONSTRAINT ck_device_connection_configs_protocol
    CHECK (protocol IN ('MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'));
  `);
  await knex.schema.raw(`
    ALTER TABLE device_measurement_channels
    ADD CONSTRAINT ck_device_measurement_channels_address
    CHECK (address_id >= 40001);
  `);
  await knex.schema.raw(`
    ALTER TABLE device_measurement_channels
    ADD CONSTRAINT ck_device_measurement_channels_value_format
    CHECK (
      value_format IS NULL OR
      value_format IN ('MEASUREMENT_VALUE', 'CURRENT', 'VOLTAGE')
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('device_measurement_channels');
  await knex.schema.dropTableIfExists('device_connection_configs');
}
