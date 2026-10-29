import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { integrationDeviceConfigsService } from '../../src/modules/integrations/integration-device-configs.service';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
}));

const statuses = [
  'PENDING_DESIGN_REVIEW',
  'WAITING_FACTORY_REVISION',
  'REVISED_PENDING_DESIGN_REVIEW',
  'WAITING_CONNECTION',
  'CONNECTION_CONFIRMED',
  'CONNECTED',
  'REJECTED',
] as const;
const point = {
  id: 10268,
  request_id: 10191,
  point_name: 'จุดที่ 1',
  point_code: 'P0437',
  point_type: 'WASTEWATER',
  details_json: null,
  instruments_json: null,
  deleted_at: null,
};
function config(id: number, requestId: number | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    request_id: requestId,
    station_id: 'P0437',
    device_code: 'P0437/01',
    protocol: 'MODBUS_TCP',
    settings_json: '{"hostIp":"127.0.0.1","port":10502,"slaveId":1}',
    status_management_json: null,
    source_request_id: requestId,
    source_recorded: 1,
    created_by: 1,
    updated_by: 1,
    created_at: '2026-10-22T08:00:00Z',
    updated_at: '2026-10-22T08:00:00Z',
    deleted_at: null,
    ...extra,
  };
}
function channel(id: number) {
  return {
    id,
    config_id: id,
    address_id: 2,
    data_type: 'BOD (mg/l)',
    test_mode: 0,
    value_range_json: null,
    alert_low: null,
    alert_high: null,
    value_format: 'MEASUREMENT_VALUE',
    scale_min: null,
    scale_max: null,
    gain: null,
    offset_value: 0.1,
    encoding: 'SIGNED16_BIG_ENDIAN',
    parameter_status: 'Normal',
    deleted_at: null,
    created_by: 1,
    updated_by: 1,
    updated_at: '2026-10-22T08:00:00Z',
  };
}

describe('integration config request status with executable repository queries', () => {
  let fixture: KnexSqliteFixture;
  const originalMode = env.FACTORY_PROFILE_MODE;
  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    fixture = await createKnexSqliteFixture(
      db,
      {
        cems_wpms_connection_requests: [
          {
            id: 10191,
            status: 'CONNECTION_CONFIRMED',
            system_type: 'WPMS',
            deleted_at: null,
            updated_at: '2026-10-22T08:00:00Z',
          },
        ],
        cems_wpms_measurement_points: [point],
        device_connection_configs: [
          config(405, 10191),
          config(406, null, { source_request_id: 10191 }),
        ],
        device_measurement_channels: [channel(405), channel(406)],
      },
      {
        cems_wpms_connected_measurement_points: [
          'id',
          'source_request_id',
          'point_name',
          'point_code',
          'system_type',
          'point_type',
          'details_json',
          'instruments_json',
          'deleted_at',
        ],
      },
    );
    fixture.execute(`
      CREATE TRIGGER config_audit_defaults AFTER INSERT ON device_connection_configs
      BEGIN
        UPDATE device_connection_configs SET created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP) WHERE id = NEW.id;
      END;
    `);
  });
  afterEach(() => {
    fixture?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
  });

  it.each(statuses)('returns saved P0437 config in %s without a connected row', async (status) => {
    await db('cems_wpms_connection_requests').where('id', 10191).update({ status });
    const result = await integrationDeviceConfigsService.getByStationId('P0437');
    expect(result).toMatchObject({
      stationId: 'P0437',
      measurementPointType: 'WPMS',
      deviceConfigs: [{ deviceCode: 'P0437/01', port: 10502 }],
      parameterConfigs: [{ parameter: 'BOD (mg/l)', status: 'Normal', offset: 0.1 }],
    });
  });

  it('does not return a canceled-only point or its current copy', async () => {
    await db('cems_wpms_connection_requests').update({ status: 'CANCELED' });
    await expect(integrationDeviceConfigsService.getByStationId('P0437')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
  });

  it('falls back to a valid request snapshot when a canceled request overwrote the current copy', async () => {
    await db('cems_wpms_connection_requests').insert({
      id: 10190,
      status: 'CONNECTED',
      system_type: 'WPMS',
      deleted_at: null,
      updated_at: '2026-10-21T08:00:00Z',
    });
    await db('device_connection_configs').insert(
      config(400, 10190, { settings_json: '{"port":502}' }),
    );
    await db('device_measurement_channels').insert(channel(400));
    await db('cems_wpms_connection_requests').where('id', 10191).update({ status: 'CANCELED' });
    const configs = await deviceConnectionsRepository.listActiveForIntegration({
      stationId: 'P0437',
    });
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ id: 400, settings: { port: 502 } });
  });

  it('ignores an ambiguous legacy current copy from a canceled request', async () => {
    await db('device_connection_configs')
      .where('id', 406)
      .update({ source_request_id: null, source_recorded: 0 });
    await db('cems_wpms_connection_requests').update({ status: 'CANCELED' });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
  });

  it('keeps an explicitly saved current config independent of a canceled request', async () => {
    await db('device_connection_configs')
      .where('id', 406)
      .update({ source_request_id: null, source_recorded: 1 });
    await db('cems_wpms_connection_requests').update({ status: 'CANCELED' });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([expect.objectContaining({ id: 406 })]);
  });

  it('does not resurrect a device explicitly removed from current settings', async () => {
    await db('device_connection_configs')
      .where('id', 406)
      .update({ deleted_at: '2026-10-22T09:00:00Z' });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
  });

  it('returns a snapshot-only saved config when no current copy has ever existed', async () => {
    await db('device_connection_configs').where('id', 406).delete();
    const result = await integrationDeviceConfigsService.getByStationId('P0437');
    expect(result.deviceConfigs).toEqual([expect.objectContaining({ port: 10502 })]);
  });

  it('records the request source on a real save and stops returning it after cancellation', async () => {
    await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      [
        {
          stationId: 'P0437',
          deviceCode: 'P0437/01',
          protocol: 'MODBUS_TCP',
          settings: { port: 1502 },
          channels: [{ dataType: 'BOD (mg/l)', addressId: 2, offset: 0.1 }],
        },
      ],
      42,
      10191,
    );
    const current = await db('device_connection_configs')
      .whereNull('request_id')
      .whereNull('deleted_at')
      .first();
    expect(current).toMatchObject({ source_request_id: 10191, source_recorded: 1 });
    expect(
      (await integrationDeviceConfigsService.getByStationId('P0437')).deviceConfigs[0].port,
    ).toBe(1502);
    await db('cems_wpms_connection_requests').update({ status: 'CANCELED' });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
  });

  it('does not expose canceled connected metadata when a connected row was retained', async () => {
    await db('cems_wpms_connected_measurement_points').insert({
      id: 1,
      source_request_id: 10191,
      point_code: 'P0437',
      point_name: 'จุดที่ 1',
      system_type: 'WPMS',
      point_type: 'WASTEWATER',
      deleted_at: null,
    });
    await db('cems_wpms_connection_requests').update({ status: 'CANCELED' });
    await expect(integrationDeviceConfigsService.getByStationId('P0437')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('ignores configs whose source request was deleted or no longer exists', async () => {
    await db('cems_wpms_connection_requests').update({ deleted_at: '2026-10-22T09:00:00Z' });
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
    await db('cems_wpms_connection_requests').delete();
    expect(
      await deviceConnectionsRepository.listActiveForIntegration({ stationId: 'P0437' }),
    ).toEqual([]);
  });

  it('does not expose canceled channels or schedules when falling back to a valid snapshot', async () => {
    await db('device_connection_configs')
      .where('id', 406)
      .update({
        status_management_json: JSON.stringify({
          selectedParameters: ['BOD (mg/l)'],
          status: 'Maintenance',
          startAt: '2026-10-22 10:00:00',
          endAt: '2026-10-22 11:00:00',
        }),
      });
    await db('cems_wpms_connection_requests').insert({
      id: 10190,
      status: 'REJECTED',
      system_type: 'WPMS',
      deleted_at: null,
      updated_at: '2026-10-21T08:00:00Z',
    });
    await db('cems_wpms_measurement_points').insert({ ...point, id: 10267, request_id: 10190 });
    await db('device_connection_configs').insert(
      config(400, 10190, { settings_json: '{"port":502}' }),
    );
    await db('device_measurement_channels').insert({ ...channel(400), data_type: 'COD (mg/l)' });
    await db('cems_wpms_connection_requests').where('id', 10191).update({ status: 'CANCELED' });
    const result = await integrationDeviceConfigsService.getByStationId('P0437');
    expect(result.deviceConfigs).toEqual([expect.objectContaining({ port: 502 })]);
    expect(result.parameterConfigs.map((entry) => entry.parameter)).toEqual(['COD (mg/l)']);
    expect(result.statusSchedules).toEqual([]);
  });

  it('returns empty groups for an eligible request point without saved configurations', async () => {
    await db('device_connection_configs').delete();
    expect(await integrationDeviceConfigsService.getByStationId('P0437')).toMatchObject({
      stationId: 'P0437',
      deviceConfigs: [],
      parameterConfigs: [],
      statusSchedules: [],
    });
  });

  it('does not load config using an SQL fragment as a station identifier', async () => {
    await expect(
      integrationDeviceConfigsService.getByStationId("P0437' OR 1=1 --"),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
