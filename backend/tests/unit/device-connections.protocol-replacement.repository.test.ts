import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import type { CreateDeviceConnectionConfigInput } from '../../src/modules/device-connections/device-connections.types';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
}));

const input: CreateDeviceConnectionConfigInput = {
  stationId: 'S2014',
  deviceCode: 'S2014/01',
  protocol: 'MSSQL',
  settings: {},
  channels: [{ dataType: 'CO (ppm)', addressId: 3, offset: 0 }],
};

function config(
  id: number,
  requestId: number | null,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    request_id: requestId,
    source_request_id: requestId,
    source_recorded: 1,
    station_id: 'S2014',
    device_code: 'S2014/01',
    protocol: 'MYSQL',
    settings_json: '{}',
    status_management_json: null,
    created_by: 1,
    updated_by: 1,
    created_at: '2026-10-21T15:24:49.000Z',
    updated_at: '2026-10-21T15:24:49.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('device configuration protocol replacement', () => {
  let fixture: KnexSqliteFixture;

  beforeEach(async () => {
    fixture = await createKnexSqliteFixture(db, {
      device_connection_configs: [
        config(1, 10195),
        config(2, null),
        config(3, 10195, { device_code: 'S2014/02' }),
        config(4, null, { device_code: 'S2014/02' }),
        config(5, 10196),
        config(6, null, { station_id: 'S2015' }),
        config(7, 10195, { station_id: 'S2015' }),
      ],
      device_measurement_channels: Array.from({ length: 7 }, (_, index) => ({
        id: index + 1,
        config_id: index + 1,
        data_type: 'CO (ppm)',
        address_id: 3,
        test_mode: 0,
        value_range_json: null,
        alert_low: null,
        alert_high: null,
        value_format: null,
        scale_min: null,
        scale_max: null,
        gain: null,
        offset_value: 0,
        encoding: null,
        parameter_status: null,
        created_by: 1,
        updated_by: 1,
        created_at: '2026-10-21T15:24:49.000Z',
        updated_at: '2026-10-21T15:24:49.000Z',
        deleted_at: null,
      })),
    });
    // The production schema supplies these audit timestamps by default.
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

  afterEach(() => fixture?.close());

  it('replaces the submitted station across devices and protocols in request and current scopes only', async () => {
    await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings([input], 42, 10195);

    const retained = await db('device_connection_configs').whereNull('deleted_at').orderBy('id');
    expect(retained.filter((row) => Number(row.id) <= 7).map((row) => row.id)).toEqual([5, 6, 7]);
    expect(retained.filter((row) => Number(row.id) > 7)).toEqual([
      expect.objectContaining({ request_id: 10195, protocol: 'MSSQL', device_code: 'S2014/01' }),
      expect.objectContaining({ request_id: null, protocol: 'MSSQL', device_code: 'S2014/01' }),
    ]);
    const retiredChannels = await db('device_measurement_channels').whereIn(
      'config_id',
      [1, 2, 3, 4],
    );
    expect(retiredChannels).toHaveLength(4);
    expect(retiredChannels.every((row) => row.deleted_at !== null && row.updated_by === 42)).toBe(
      true,
    );
    expect(
      (await db('device_measurement_channels').whereIn('config_id', [5, 6, 7])).every(
        (row) => row.deleted_at === null && row.updated_by === 1,
      ),
    ).toBe(true);
  });

  it('keeps one named current config after repeated protocol switches without changing snapshots', async () => {
    await deviceConnectionsRepository.replaceActive(input, 42);
    await deviceConnectionsRepository.replaceActive({ ...input, protocol: 'MYSQL' }, 42);

    const current = await db('device_connection_configs')
      .where('station_id', 'S2014')
      .where('device_code', 'S2014/01')
      .whereNull('request_id')
      .whereNull('deleted_at');
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ protocol: 'MYSQL' });
    expect(await db('device_connection_configs').where('id', 1).first()).toMatchObject({
      deleted_at: null,
      updated_by: 1,
    });
  });

  it('replaces a named request snapshot without changing the current config or another request', async () => {
    await deviceConnectionsRepository.replaceManyForRequest([input], 42, 10195);

    expect(await db('device_connection_configs').where('id', 1).first()).toMatchObject({
      deleted_at: expect.any(String),
      updated_by: 42,
    });
    for (const id of [2, 5]) {
      expect(await db('device_connection_configs').where('id', id).first()).toMatchObject({
        deleted_at: null,
        updated_by: 1,
      });
    }
  });

  it('preserves submitted distinct protocols for legacy configs without a device code', async () => {
    fixture.execute('UPDATE device_connection_configs SET device_code = NULL WHERE id IN (1, 2)');
    const unnamed = { ...input, deviceCode: null };
    const inputs = [{ ...unnamed, protocol: 'MYSQL' as const }, unnamed];
    await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(inputs, 42, 10195);
    await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(inputs, 42, 10195);

    const current = await db('device_connection_configs')
      .where('station_id', 'S2014')
      .whereNull('device_code')
      .whereNull('deleted_at')
      .orderBy('id');
    expect(current.map((row) => [row.request_id, row.protocol])).toEqual([
      [10195, 'MYSQL'],
      [10195, 'MSSQL'],
      [null, 'MYSQL'],
      [null, 'MSSQL'],
    ]);
  });
});
