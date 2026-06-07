import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  const hasConnectedPointsTable = await knex.schema.hasTable(
    'cems_wpms_connected_measurement_points',
  );
  if (!hasConnectedPointsTable) {
    await knex.schema.createTable('cems_wpms_connected_measurement_points', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('source_request_id').notNullable();
      table.bigInteger('source_measurement_point_id').notNullable();
      table.specificType('factory_id', 'VARCHAR(64) NOT NULL');
      table.string('factory_name', 500).notNullable();
      table.specificType('factory_registration_no', 'NVARCHAR(64) NOT NULL');
      table.specificType('factory_address', 'NVARCHAR(1000) NULL');
      table.decimal('factory_latitude', 10, 7).nullable();
      table.decimal('factory_longitude', 10, 7).nullable();
      table.specificType('system_type', 'VARCHAR(8) NOT NULL');
      table.specificType('point_name', 'NVARCHAR(255) NOT NULL');
      table.specificType('point_code', 'VARCHAR(64) NULL');
      table.specificType('point_type', 'VARCHAR(32) NOT NULL');
      table.specificType('parameters_json', 'NVARCHAR(MAX) NOT NULL');
      table.specificType('details_json', 'NVARCHAR(MAX) NULL');
      table.specificType('documents_json', 'NVARCHAR(MAX) NULL');
      table.specificType('instruments_json', 'NVARCHAR(MAX) NULL');
      table.specificType('connected_at', 'DATETIME2 NULL');
      addAuditColumns(table);
      table
        .foreign('source_request_id', 'fk_connected_point_source_request')
        .references('id')
        .inTable('cems_wpms_connection_requests');
      table
        .foreign('source_measurement_point_id', 'fk_connected_point_source_measurement_point')
        .references('id')
        .inTable('cems_wpms_measurement_points');
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_connected_points_factory'
        AND object_id = OBJECT_ID('cems_wpms_connected_measurement_points')
    )
    BEGIN
      CREATE INDEX ix_connected_points_factory
      ON cems_wpms_connected_measurement_points(factory_id)
      WHERE deleted_at IS NULL;
    END
  `);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_connected_points_point_code'
        AND object_id = OBJECT_ID('cems_wpms_connected_measurement_points')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_connected_points_point_code
      ON cems_wpms_connected_measurement_points(point_code)
      WHERE deleted_at IS NULL AND point_code IS NOT NULL;
    END
  `);

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

  await backfillConnectedPoints(knex);
  await backfillActiveDeviceSettings(knex);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_active_station_protocol_device'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_device_connection_configs_active_station_protocol_device
      ON device_connection_configs(station_id, protocol, device_code)
      WHERE deleted_at IS NULL AND request_id IS NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_connection_configs_active_station_protocol_device'
        AND object_id = OBJECT_ID('device_connection_configs')
    )
    BEGIN
      DROP INDEX uq_device_connection_configs_active_station_protocol_device
      ON device_connection_configs;
    END
  `);

  await knex.schema.dropTableIfExists('cems_wpms_connected_measurement_points');

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

async function backfillConnectedPoints(knex: Knex): Promise<void> {
  const rows = await knex('cems_wpms_connection_requests as r')
    .join('cems_wpms_measurement_points as p', 'p.request_id', 'r.id')
    .where('r.status', 'CONNECTED')
    .whereNull('r.deleted_at')
    .whereNull('p.deleted_at')
    .select(
      'r.id as source_request_id',
      'p.id as source_measurement_point_id',
      'r.factory_id',
      'r.factory_name',
      'r.factory_registration_no',
      'r.address as factory_address',
      'r.latitude as factory_latitude',
      'r.longitude as factory_longitude',
      'r.system_type',
      'p.point_name',
      'p.point_code',
      'p.point_type',
      'p.parameters_json',
      'p.details_json',
      'p.documents_json',
      'p.instruments_json',
      'r.verified_at as connected_at',
      'r.created_by',
      'r.created_by as updated_by',
    );

  for (const row of rows) {
    const exists = await knex('cems_wpms_connected_measurement_points')
      .whereNull('deleted_at')
      .modify((builder) => {
        if (row.point_code) {
          builder.where('point_code', row.point_code);
        } else {
          builder.where('source_measurement_point_id', row.source_measurement_point_id);
        }
      })
      .first('id');

    if (!exists) {
      await knex('cems_wpms_connected_measurement_points').insert(row);
    }
  }
}

async function backfillActiveDeviceSettings(knex: Knex): Promise<void> {
  const requestConfigs = await knex('device_connection_configs')
    .whereNotNull('request_id')
    .whereNull('deleted_at')
    .select(
      'id',
      'station_id',
      'device_code',
      'protocol',
      'settings_json',
      'status_management_json',
      'created_by',
      'updated_by',
    );

  for (const config of requestConfigs) {
    const existing = await knex('device_connection_configs')
      .whereNull('request_id')
      .whereNull('deleted_at')
      .where('station_id', config.station_id)
      .where('protocol', config.protocol)
      .modify((builder) => {
        if (config.device_code) {
          builder.where('device_code', config.device_code);
        } else {
          builder.whereNull('device_code');
        }
      })
      .first('id');

    if (existing) continue;

    const [{ id: activeConfigId }] = await knex('device_connection_configs')
      .insert({
        request_id: null,
        station_id: config.station_id,
        device_code: config.device_code,
        protocol: config.protocol,
        settings_json: config.settings_json,
        status_management_json: config.status_management_json,
        created_by: config.created_by,
        updated_by: config.updated_by,
      })
      .returning('id');

    const channels = await knex('device_measurement_channels')
      .where('config_id', config.id)
      .whereNull('deleted_at')
      .select(
        'address_id',
        'data_type',
        'value_range_json',
        'value_format',
        'offset_value',
        'encoding',
        'parameter_status',
        'created_by',
        'updated_by',
      );

    if (channels.length > 0) {
      await knex('device_measurement_channels').insert(
        channels.map((channel) => ({
          ...channel,
          config_id: activeConfigId,
        })),
      );
    }
  }
}
