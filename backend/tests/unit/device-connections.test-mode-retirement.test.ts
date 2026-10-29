import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { integrationDeviceConfigsService } from '../../src/modules/integrations/integration-device-configs.service';
import { listActiveAlertParameterActivations } from '../../src/modules/alert-emails/alert-parameter-activations.repository';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

describe('retired test mode through device configuration services', () => {
  let fixture: KnexSqliteFixture;
  const originalMode = env.FACTORY_PROFILE_MODE;

  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    fixture = await createKnexSqliteFixture(
      db,
      {
        device_connection_configs: [
          {
            id: 10,
            request_id: null,
            source_request_id: null,
            source_recorded: 1,
            station_id: 'S_TESTMODE',
            device_code: 'S_TESTMODE/01',
            protocol: 'MODBUS_TCP',
            settings_json: '{}',
            status_management_json: null,
            created_by: 42,
            updated_by: 42,
            created_at: '2026-10-26T00:00:00.000Z',
            updated_at: '2026-10-26T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        device_measurement_channels: [
          {
            id: 20,
            config_id: 10,
            address_id: 3,
            data_type: 'CO (ppm)',
            test_mode: 1,
            value_range_json: null,
            alert_low: null,
            alert_high: null,
            value_format: 'MEASUREMENT_VALUE',
            scale_min: null,
            scale_max: null,
            gain: null,
            offset_value: 0,
            encoding: null,
            parameter_status: 'Maintenance',
            created_by: 42,
            updated_by: 42,
            updated_at: '2026-10-26T00:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
      {
        cems_wpms_connected_measurement_points: [
          'id',
          'point_code',
          'point_name',
          'source_request_id',
          'connected_at',
          'system_type',
          'point_type',
          'details_json',
          'instruments_json',
          'deleted_at',
        ],
        cems_wpms_connection_requests: ['id', 'status', 'deleted_at'],
        alert_parameter_activations: [
          'id',
          'connected_point_id',
          'parameter_code',
          'unit',
          'activated_at',
          'deactivated_at',
        ],
      },
    );
    fixture.execute(`
      CREATE TRIGGER config_audit_defaults AFTER INSERT ON device_connection_configs
      BEGIN
        UPDATE device_connection_configs
        SET created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
        WHERE id = NEW.id;
      END;
    `);
  });

  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
  });

  it('returns a legacy true flag as false while preserving the configured parameter status', async () => {
    const result = await deviceConnectionsService.getById(10);

    expect(result.channels).toEqual([
      expect.objectContaining({
        dataType: 'CO (ppm)',
        addressId: 3,
        testMode: false,
        status: 'Maintenance',
      }),
    ]);
  });

  it('accepts a legacy true payload while saving a normal channel that can be read back', async () => {
    fixture.execute(`
      CREATE TRIGGER require_retired_test_mode BEFORE INSERT ON device_measurement_channels
      WHEN NEW.test_mode <> 0
      BEGIN
        SELECT RAISE(ABORT, 'new channels must not enable test mode');
      END;
    `);

    const [saved] = await deviceConnectionsService.createMany(
      [
        {
          stationId: 'S_TESTMODE',
          deviceCode: 'S_TESTMODE/02',
          protocol: 'MODBUS_TCP',
          settings: {},
          channels: [
            {
              dataType: 'NOx (ppm)',
              addressId: 4,
              testMode: true,
              offset: 0,
              status: 'Calibration',
            },
          ],
        },
      ],
      42,
    );
    const readBack = await deviceConnectionsService.getById(saved.id);

    expect(readBack.channels).toEqual([
      expect.objectContaining({
        dataType: 'NOx (ppm)',
        testMode: false,
        status: 'Calibration',
      }),
    ]);
  });

  it('keeps legacy test channels eligible when saving the current configuration', async () => {
    fixture.execute(
      'INSERT INTO cems_wpms_connected_measurement_points (id, point_code, point_name, connected_at, deleted_at) VALUES (?, ?, ?, ?, NULL)',
      [7, 'S_TESTMODE', 'Stack', '2026-09-01T00:00:00.000Z'],
    );

    await deviceConnectionsService.createMany(
      [
        {
          stationId: 'S_TESTMODE',
          deviceCode: 'S_TESTMODE/02',
          protocol: 'MODBUS_TCP',
          settings: {},
          channels: [{ dataType: 'NOx (ppm)', addressId: 4, offset: 0 }],
        },
      ],
      42,
    );

    expect(await listActiveAlertParameterActivations(7)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parameterCode: 'co', unit: 'ppm' }),
        expect.objectContaining({ parameterCode: 'nox', unit: 'ppm' }),
      ]),
    );
  });

  it('returns false to the ingestion integration for an unchanged legacy true channel', async () => {
    fixture.execute(
      'INSERT INTO cems_wpms_connected_measurement_points (id, point_code, point_name, system_type, point_type) VALUES (?, ?, ?, ?, ?)',
      [7, 'S_TESTMODE', 'Stack', 'CEMS', 'STACK'],
    );

    const result = await integrationDeviceConfigsService.getByStationId('S_TESTMODE');

    expect(result.parameterConfigs).toEqual([
      expect.objectContaining({
        parameter: 'CO (ppm)',
        testMode: false,
        status: 'Maintenance',
      }),
    ]);
  });
});
