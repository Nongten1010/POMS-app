import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { down, up } from '../../src/db/migrations/0146_retire_device_channel_test_mode';
import { listActiveAlertParameterActivations } from '../../src/modules/alert-emails/alert-parameter-activations.repository';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const cutover = '2026-10-26T03:00:00.000Z';

describe('retiring Test mode on existing registered channels', () => {
  let fixture: KnexSqliteFixture;
  let restoreClock: () => void;

  beforeEach(async () => {
    fixture = await createKnexSqliteFixture(
      db,
      {
        cems_wpms_connected_measurement_points: [
          {
            id: 7,
            point_code: 'S1',
            point_name: 'Stack 1',
            parameters_json: '["CO (ppm)"]',
            connected_at: '2026-09-01T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        device_connection_configs: [
          { id: 11, station_id: 'S1', request_id: null, deleted_at: null },
        ],
        device_measurement_channels: [
          { id: 101, config_id: 11, data_type: 'CO (ppm)', test_mode: true, deleted_at: null },
        ],
      },
      {
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
    const context = (db as Knex & { context: { raw: typeof db.raw } }).context;
    const originalRaw = context.raw.bind(context);
    const clock = jest
      .spyOn(context, 'raw')
      .mockImplementation(((sql: unknown, bindings: unknown) =>
        sql === 'SELECT SYSUTCDATETIME() AS cutover_at'
          ? Promise.resolve([{ cutover_at: cutover }])
          : bindings === undefined
            ? originalRaw(sql as string)
            : originalRaw(sql as string, bindings as Knex.RawBinding[])) as typeof db.raw);
    restoreClock = () => clock.mockRestore();
  });

  afterEach(() => {
    restoreClock?.();
    fixture?.close();
  });

  it('starts a formerly-test approved parameter at cutover instead of backdating its alert history', async () => {
    await up(db);

    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: cutover },
    ]);
  });

  it('never activates a formerly-test channel before a future verified connection time', async () => {
    const connectedAt = '2026-10-27T03:00:00.000Z';
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET connected_at = ?', [
      connectedAt,
    ]);

    await up(db);

    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: connectedAt },
    ]);
  });

  it('fails before altering channels when the verified connection timestamp is invalid', async () => {
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET connected_at = ?', [
      'invalid',
    ]);

    await expect(up(db)).rejects.toThrow('Invalid connected point timestamp');
    expect(await db('device_measurement_channels').first('test_mode')).toEqual({ test_mode: 1 });
    expect(await listActiveAlertParameterActivations(7)).toEqual([]);
  });

  it('retires persisted flags on current, request-snapshot, and deleted channels', async () => {
    fixture.execute('INSERT INTO device_connection_configs VALUES (12, ?, 101, NULL)', ['S1']);
    fixture.execute('INSERT INTO device_measurement_channels VALUES (102, 12, ?, 1, NULL)', [
      'CO (ppm)',
    ]);
    fixture.execute('INSERT INTO device_measurement_channels VALUES (103, 11, ?, 1, ?)', [
      'CO (%)',
      '2026-10-01T00:00:00Z',
    ]);

    await up(db);

    // A migration's persisted data is its public output; no application policy is mocked.
    expect(
      (await db('device_measurement_channels').orderBy('id').select('test_mode')).map(
        (row) => row.test_mode,
      ),
    ).toEqual([0, 0, 0]);
    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: cutover },
    ]);
  });

  it('preserves an existing active episode and creates only approved missing units', async () => {
    fixture.execute('INSERT INTO alert_parameter_activations VALUES (1, 7, ?, ?, ?, NULL)', [
      'co',
      'ppm',
      '2026-09-15T00:00:00.000Z',
    ]);
    fixture.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      '["CO (ppm)","CO₂ (ppm)"]',
    ]);
    for (const [id, label] of [
      [102, 'CO (%)'],
      [103, 'CO2 ( ppm )'],
      [104, 'CO₂ (ppm)'],
      [105, 'NOx (ppm)'],
    ] as const) {
      fixture.execute('INSERT INTO device_measurement_channels VALUES (?, 11, ?, 1, NULL)', [
        id,
        label,
      ]);
    }

    await up(db);

    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: '2026-09-15T00:00:00.000Z' },
      { parameterCode: 'co2', unit: 'ppm', activatedAt: cutover },
    ]);
  });

  it('never activates request snapshots, deleted channels/configs, or retired points', async () => {
    fixture.execute(
      'INSERT INTO cems_wpms_connected_measurement_points VALUES (8, ?, ?, ?, ?, ?)',
      ['S2', 'Stack 2', '["NOx (ppm)"]', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'],
    );
    fixture.execute('INSERT INTO device_connection_configs VALUES (12, ?, 101, NULL)', ['S1']);
    fixture.execute('INSERT INTO device_connection_configs VALUES (13, ?, NULL, ?)', [
      'S1',
      '2026-10-01T00:00:00Z',
    ]);
    fixture.execute('INSERT INTO device_connection_configs VALUES (14, ?, NULL, NULL)', ['S2']);
    for (const [id, configId, deletedAt] of [
      [102, 12, null],
      [103, 13, null],
      [104, 14, null],
      [105, 11, '2026-10-01T00:00:00Z'],
    ] as const) {
      fixture.execute('INSERT INTO device_measurement_channels VALUES (?, ?, ?, 1, ?)', [
        id,
        configId,
        'NOx (ppm)',
        deletedAt,
      ]);
    }

    await up(db);

    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: cutover },
    ]);
    expect(await listActiveAlertParameterActivations(8)).toEqual([]);
  });

  it('is safe to retry and never restores retired flags or rewrites historical audit dates', async () => {
    fixture.execute('ALTER TABLE device_measurement_channels ADD COLUMN updated_at TEXT');
    fixture.execute('UPDATE device_measurement_channels SET updated_at = ?', [
      '2026-09-01T00:00:00Z',
    ]);

    await up(db);
    await up(db);
    await down(db);

    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: cutover },
    ]);
    expect(await db('device_measurement_channels').select('test_mode', 'updated_at')).toEqual([
      { test_mode: 0, updated_at: '2026-09-01T00:00:00Z' },
    ]);
  });
});
