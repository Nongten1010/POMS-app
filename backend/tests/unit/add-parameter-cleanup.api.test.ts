import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { parameterValuesRoutes } from '../../src/modules/parameter-values/parameter-values.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';
import { parameterCleanupSourceFixture } from '../helpers/parameter-cleanup-source-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
const originalSchema = env.PARAMETER_DB_SCHEMA;
let primary: KnexSqliteFixture;
let source: Awaited<ReturnType<typeof parameterCleanupSourceFixture>>;
const intervals = ['real', '1m', '5m', '60m', '1day', 'test'];
const now = '2026-10-25T03:00:00.000Z';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  server.use('/api/v1/parameter-values', parameterValuesRoutes);
  server.use(errorHandler);
  return server;
}

function token() {
  return signTestAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: { 'cems_wpms_requests:approve': 'ALL', 'cems_wpms_requests:view': 'ALL' },
  });
}

const approve = () =>
  request(app())
    .post('/api/v1/cems-wpms-requests/101/verify-connection')
    .set('Authorization', `Bearer ${token()}`)
    .send({});
const read = (interval: string) =>
  request(app())
    .get(
      `/api/v1/parameter-values?stationId=S2001&interval=${interval}&startDate=2026-10-01&endDate=2026-10-31`,
    )
    .set('Authorization', `Bearer ${token()}`);

function addSourceFamily(
  prefix: string,
  value: string | null,
  unit: string | null,
  status: string | null,
) {
  for (const interval of intervals) {
    const table = `S2001_data_${interval}`;
    for (const [suffix, content] of [
      ['value', value],
      ['units', unit],
      ['status', status],
    ]) {
      const column = `${prefix}_${suffix}`;
      source.execute(`ALTER TABLE ingest.${table} ADD COLUMN ${column} TEXT`);
      source.execute(
        'INSERT INTO sys.columns SELECT object_id, ?, 1 FROM sys.tables WHERE name = ?',
        [column, table],
      );
      source.execute(`UPDATE ingest.${table} SET ${column} = ?`, [content]);
    }
  }
}

function parameterSelection(requested: string[], connected = ['CO (ppm)']) {
  primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
    JSON.stringify(connected),
  ]);
  primary.execute('UPDATE cems_wpms_measurement_points SET parameters_json = ?', [
    JSON.stringify(requested),
  ]);
}

describe('approved added parameters clear only their prior measurements', () => {
  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    env.PARAMETER_DB_SCHEMA = 'ingest';
    primary = await createKnexSqliteFixture(
      db,
      {
        cems_wpms_connection_requests: [
          {
            id: 101,
            eligible_factory_id: 17,
            request_no: 'CEMS-0101/2569',
            request_type: 'ADD_PARAMETER',
            factory_id: 'FACTORY-A',
            factory_name: 'Factory A',
            factory_registration_no: 'REG-A',
            system_type: 'CEMS',
            status: 'CONNECTION_CONFIRMED',
            contact_name: 'Operator',
            contact_phone: '0812345678',
            created_by: 42,
            updated_by: 42,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            verified_at: null,
            confirmed_at: now,
            connection_due_at: null,
            officer_note: null,
            revision_reason: null,
          },
        ],
        cems_wpms_measurement_points: [
          {
            id: 201,
            request_id: 101,
            point_code: 'S2001',
            point_name: 'Boiler',
            point_type: 'STACK',
            parameters_json: JSON.stringify(['CO (ppm)', 'NOx (ppm)']),
            deleted_at: null,
          },
        ],
        cems_wpms_request_factory_snapshots: [{ id: 1, request_id: 101, deleted_at: null }],
        cems_wpms_request_status_history: [],
        users: [
          { id: 42, username: 'officer', prename_th: '', first_name: 'Officer', last_name: '' },
        ],
        eligible_factories: [
          {
            id: 17,
            deleted_at: null,
            latitude: null,
            longitude: null,
            eia_assessment: null,
            eia_other: null,
            has_eia: null,
            project_name: null,
          },
        ],
        cems_wpms_connected_measurement_points: [
          {
            id: 301,
            source_request_id: 1,
            source_measurement_point_id: 1,
            eligible_factory_id: 17,
            factory_id: 'FACTORY-A',
            factory_name: 'Factory A',
            factory_registration_no: 'REG-A',
            factory_address: null,
            factory_latitude: null,
            factory_longitude: null,
            factory_eia_assessment: null,
            factory_eia_other: null,
            factory_has_eia: null,
            factory_project_name: null,
            factory_front_photos_json: null,
            factory_logo_json: null,
            system_type: 'CEMS',
            point_code: 'S2001',
            point_name: 'Boiler',
            point_type: 'STACK',
            parameters_json: JSON.stringify(['CO (ppm)']),
            instruments_json: null,
            deleted_at: null,
            monitoring_point_status: null,
            details_json: null,
            documents_json: null,
            connected_at: now,
            created_by: 42,
            updated_by: 42,
            updated_at: now,
          },
        ],
        device_connection_configs: [],
        device_measurement_channels: [],
        alert_parameter_activations: [],
      },
      {
        cems_wpms_request_status_history: [
          'id',
          'request_id',
          'status',
          'note',
          'changed_by',
          'changed_at',
        ],
        device_connection_configs: ['id', 'station_id', 'request_id', 'protocol', 'deleted_at'],
        device_measurement_channels: ['id', 'config_id', 'data_type', 'test_mode', 'deleted_at'],
        cems_wpms_measurement_points: ['instruments_json'],
        alert_parameter_activations: [
          'id',
          'connected_point_id',
          'parameter_code',
          'unit',
          'activated_at',
          'deactivated_at',
          'created_at',
        ],
      },
    );
    primary.execute(`CREATE TRIGGER fixture_history_time AFTER INSERT ON cems_wpms_request_status_history
      WHEN NEW.changed_at IS NULL BEGIN UPDATE cems_wpms_request_status_history
      SET changed_at = '${now}' WHERE rowid = NEW.rowid; END`);
    source = await parameterCleanupSourceFixture(parameterSourceDb);
    for (const interval of intervals)
      source.createTable(`S2001_data_${interval}`, [
        {
          station_id: 'S2001',
          cdate: '2026-10-25',
          ctime: '10:15:00',
          co_value: '12.5',
          co_units: 'ppm',
          co_status: 'Normal',
          nox_value: '88.2',
          nox_units: 'ppm',
          nox_status: 'Maintenance',
        },
      ]);
  });

  afterEach(() => {
    source?.close();
    primary?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
    env.PARAMETER_DB_SCHEMA = originalSchema;
  });

  it('retains every row and the original parameter when the officer verifies one new parameter', async () => {
    const verified = await approve();
    expect({ status: verified.status, body: verified.body }).toMatchObject({
      status: 200,
      body: { success: true, data: { status: 'CONNECTED' } },
    });
    for (const interval of intervals) {
      const measured = await read(interval);
      expect({ status: measured.status, body: measured.body }).toMatchObject({
        status: 200,
        body: {
          data: [
            {
              station_id: 'S2001',
              cdate: '2026-10-25',
              ctime: '10:15:00',
              co_value: '12.5',
              co_units: 'ppm',
              co_status: 'Normal',
              nox_value: null,
              nox_units: 'ppm',
              nox_status: null,
            },
          ],
          meta: { count: 1 },
        },
      });
    }
  });

  it('keeps newly received values when retrying after the measurement commit acknowledgement was lost', async () => {
    source.state.loseCommitReply = true;
    const uncertain = await approve();
    expect(uncertain.status).toBe(503);
    expect(uncertain.body).toMatchObject({
      error: { code: 'MEASUREMENT_CLEANUP_FAILED', details: { retryable: true } },
    });
    source.state.loseCommitReply = false;
    source.execute("UPDATE ingest.S2001_data_real SET nox_value = '99.5', nox_status = 'Normal'");
    const retry = await approve();
    expect(retry.status).toBe(200);
    const measured = await read('real');
    expect(measured.body.data[0]).toMatchObject({
      nox_value: '99.5',
      nox_status: 'Normal',
      co_value: '12.5',
    });
  });

  it('refuses approval when the source unit is missing instead of leaving ambiguous test values active', async () => {
    source.execute('UPDATE ingest.S2001_data_real SET nox_units = NULL');
    const verified = await approve();
    expect(verified.status).toBe(503);
    expect(verified.body).toMatchObject({ error: { code: 'MEASUREMENT_CLEANUP_FAILED' } });
  });

  it('requires visibility of measurement metadata before treating any table as missing', async () => {
    source.state.denyMetadata = true;
    const verified = await approve();
    expect(verified.status).toBe(503);
    source.state.denyMetadata = false;
    expect((await approve()).status).toBe(200);
  });

  it('preserves an existing unitless parameter rather than guessing it is a different new parameter', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'NOx']),
    ]);
    expect((await approve()).status).toBe(503);
  });

  it('clears a unit containing the micro sign using the source spelling', async () => {
    primary.execute('UPDATE cems_wpms_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'NOx (µg/m3)']),
    ]);
    for (const interval of intervals)
      source.execute(`UPDATE ingest.S2001_data_${interval} SET nox_units = 'µg/m3'`);
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      nox_value: null,
      nox_status: null,
      nox_units: 'µg/m3',
      co_value: '12.5',
    });
  });

  it('accepts parameter columns whose names contain underscores', async () => {
    primary.execute('UPDATE cems_wpms_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'PM2.5 (µg/m3)']),
    ]);
    for (const interval of intervals) {
      const table = `S2001_data_${interval}`;
      for (const suffix of ['value', 'units', 'status']) {
        source.execute(
          `ALTER TABLE ingest.${table} RENAME COLUMN nox_${suffix} TO pm2_5_${suffix}`,
        );
        source.execute(
          'UPDATE sys.columns SET name = ? WHERE name = ? AND object_id = (SELECT object_id FROM sys.tables WHERE name = ?)',
          [`pm2_5_${suffix}`, `nox_${suffix}`, table],
        );
      }
      source.execute(`UPDATE ingest.${table} SET pm2_5_units = 'µg/m3'`);
    }
    const pending = await request(app())
      .get('/api/v1/parameter-values/connection-test?stationId=S2001')
      .set('Authorization', `Bearer ${token()}`);
    expect(pending.body.data[0]).toMatchObject({
      values: { 'PM2.5 (µg/m3)': '88.2' },
      statuses: { 'PM2.5 (µg/m3)': 'Maintenance' },
    });
    const verified = await approve();
    expect(verified.status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      co_value: '12.5',
      co_status: 'Normal',
    });
    const cleared = await request(app())
      .get('/api/v1/parameter-values/connection-test?stationId=S2001')
      .set('Authorization', `Bearer ${token()}`);
    expect(cleared.body.data[0]).toMatchObject({
      values: { 'PM2.5 (µg/m3)': null, 'CO (ppm)': '12.5' },
      statuses: { 'PM2.5 (µg/m3)': null, 'CO (ppm)': 'Normal' },
    });
  });

  it('does not approve when a source trigger silently keeps the target values', async () => {
    source.execute(`CREATE TRIGGER ingest.keep_measurements BEFORE UPDATE OF nox_value ON S2001_data_real
      BEGIN SELECT RAISE(IGNORE); END`);
    expect((await approve()).status).toBe(503);
    source.execute('DROP TRIGGER ingest.keep_measurements');
    expect((await approve()).status).toBe(200);
  });

  it('retains approved Flow values when a request repeats the Flow Rate alias', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'Flow (m3/hr)']),
    ]);
    primary.execute('UPDATE cems_wpms_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'Flow Rate (m3/hr)']),
    ]);
    for (const interval of intervals) {
      const table = `S2001_data_${interval}`;
      for (const suffix of ['value', 'units', 'status']) {
        source.execute(`ALTER TABLE ingest.${table} ADD COLUMN flow_${suffix} TEXT`);
        source.execute(
          'INSERT INTO sys.columns SELECT object_id, ?, 1 FROM sys.tables WHERE name = ?',
          [`flow_${suffix}`, table],
        );
      }
      source.execute(
        `UPDATE ingest.${table} SET flow_value = '125', flow_units = 'm3/hr', flow_status = 'Normal'`,
      );
    }
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      flow_value: '125',
      flow_status: 'Normal',
      co_value: '12.5',
    });
  });

  it('fails closed when the approved parameter list cannot be decoded', async () => {
    primary.execute(
      "UPDATE cems_wpms_connected_measurement_points SET parameters_json = 'invalid-json'",
    );
    expect((await approve()).status).toBe(503);
  });

  it('preserves values of a different unit in the same source column family', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'NOx (%)']),
    ]);
    for (const interval of intervals)
      source.execute(`INSERT INTO ingest.S2001_data_${interval}
      (station_id, cdate, ctime, co_value, co_units, co_status, nox_value, nox_units, nox_status)
      VALUES ('S2001', '2026-10-25', '10:14:00', '12', 'ppm', 'Normal', '1.5', '%', 'Normal')`);
    expect((await approve()).status).toBe(200);
    const measured = await read('real');
    expect(measured.body.data).toEqual([
      expect.objectContaining({
        nox_value: null,
        nox_status: null,
        nox_units: 'ppm',
        co_value: '12.5',
      }),
      expect.objectContaining({
        nox_value: '1.5',
        nox_status: 'Normal',
        nox_units: '%',
        co_value: '12',
      }),
    ]);
  });

  it('rolls back every interval when a later measurement update fails', async () => {
    source.state.failUpdateAt = 2;
    expect((await approve()).status).toBe(503);
    const pending = await request(app())
      .get('/api/v1/parameter-values/connection-test?stationId=S2001')
      .set('Authorization', `Bearer ${token()}`);
    expect({ status: pending.status, body: pending.body }).toMatchObject({
      status: 200,
      body: { data: [{ values: { 'NOx (ppm)': '88.2', 'CO (ppm)': '12.5' } }] },
    });
    source.state.failUpdateAt = 0;
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({ nox_value: null, co_value: '12.5' });
  });

  it('preserves post-cleanup values on retry when the primary connection transaction failed', async () => {
    primary.execute(`CREATE TRIGGER stop_connection BEFORE INSERT ON cems_wpms_connected_measurement_points
      BEGIN SELECT RAISE(ABORT, 'Synthetic connection failure'); END`);
    expect((await approve()).status).toBe(500);
    primary.execute('DROP TRIGGER stop_connection');
    source.execute("UPDATE ingest.S2001_data_real SET nox_value = '99.5', nox_status = 'Normal'");
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      nox_value: '99.5',
      nox_status: 'Normal',
      co_value: '12.5',
    });
  });

  it('skips a missing interval and preserves a table created after its cleanup receipt', async () => {
    source.execute('DROP TABLE ingest.S2001_data_test');
    source.execute("DELETE FROM sys.tables WHERE name = 'S2001_data_test'");
    source.state.loseCommitReply = true;
    expect((await approve()).status).toBe(503);
    source.state.loseCommitReply = false;
    source.createTable('S2001_data_test', [
      {
        station_id: 'S2001',
        cdate: '2026-10-25',
        ctime: '10:16:00',
        co_value: '12.5',
        co_units: 'ppm',
        co_status: 'Normal',
        nox_value: '101',
        nox_units: 'ppm',
        nox_status: 'Normal',
      },
    ]);
    expect((await approve()).status).toBe(200);
    expect((await read('test')).body.data[0]).toMatchObject({ nox_value: '101', co_value: '12.5' });
  });

  it('rejects multiple physical columns matching the same parameter instead of selecting one', async () => {
    source.execute('ALTER TABLE ingest.S2001_data_real ADD COLUMN n_o_x_value TEXT');
    source.execute(
      "INSERT INTO sys.columns SELECT object_id, 'n_o_x_value', 1 FROM sys.tables WHERE name = 'S2001_data_real'",
    );
    expect((await approve()).status).toBe(503);
  });

  it('clears dedicated ppm data before recording success when generic CO2 columns are empty', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'CO2 (%)']),
    ]);
    primary.execute('UPDATE cems_wpms_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO (ppm)', 'CO2 (ppm)']),
    ]);
    for (const interval of intervals) {
      const table = `S2001_data_${interval}`;
      for (const [prefix, value, unit, status] of [
        ['co2', null, null, null],
        ['co2_ppm', '530', 'ppm', 'Maintenance'],
        ['co2_percent', '0.04', '%', 'Normal'],
      ]) {
        for (const [suffix, content] of [
          ['value', value],
          ['units', unit],
          ['status', status],
        ]) {
          const column = `${prefix}_${suffix}`;
          source.execute(`ALTER TABLE ingest.${table} ADD COLUMN ${column} TEXT`);
          source.execute(
            'INSERT INTO sys.columns SELECT object_id, ?, 1 FROM sys.tables WHERE name = ?',
            [column, table],
          );
          source.execute(`UPDATE ingest.${table} SET ${column} = ?`, [content]);
        }
      }
    }
    expect((await approve()).status).toBe(200);
    for (const interval of intervals)
      expect((await read(interval)).body.data[0]).toMatchObject({
        co_value: '12.5',
        co2_ppm_value: null,
        co2_ppm_status: null,
        co2_percent_value: '0.04',
        co2_percent_status: 'Normal',
      });
  });

  it('clears all matching ppm families and retains both dedicated and generic percent values', async () => {
    parameterSelection(['CO (ppm)', 'CO2 (ppm)'], ['CO (ppm)', 'CO2 (%)']);
    addSourceFamily('co2', '529', 'ppm', 'Calibration');
    addSourceFamily('co2_ppm', '530', 'ppm', 'Maintenance');
    addSourceFamily('co2_percent', '0.04', '%', 'Normal');
    for (const interval of intervals)
      source.execute(`INSERT INTO ingest.S2001_data_${interval}
      (station_id, cdate, ctime, co_value, co_units, co_status, co2_value, co2_units, co2_status)
      VALUES ('S2001', '2026-10-25', '10:14:00', '12', 'ppm', 'Normal', '0.03', '%', 'Normal')`);
    expect((await approve()).status).toBe(200);
    for (const interval of intervals)
      expect((await read(interval)).body.data).toEqual([
        expect.objectContaining({
          co2_value: null,
          co2_status: null,
          co2_units: 'ppm',
          co2_ppm_value: null,
          co2_ppm_status: null,
          co2_percent_value: '0.04',
          co2_percent_status: 'Normal',
          co_value: '12.5',
        }),
        expect.objectContaining({
          co2_value: '0.03',
          co2_status: 'Normal',
          co2_units: '%',
          co_value: '12',
        }),
      ]);
  });

  it('approves dimensionless pH and clears its values while preserving blank units and other parameters', async () => {
    parameterSelection(['CO (ppm)', 'pH']);
    addSourceFamily('ph', '7.2', null, 'Maintenance');
    source.execute("UPDATE ingest.S2001_data_1m SET ph_units = ''");
    expect((await approve()).status).toBe(200);
    for (const interval of intervals)
      expect((await read(interval)).body.data[0]).toMatchObject({
        ph_value: null,
        ph_status: null,
        ph_units: interval === '1m' ? '' : null,
        co_value: '12.5',
        co_status: 'Normal',
      });
  });

  it('retains an existing pH parameter when its legacy display label contains pH as the unit', async () => {
    parameterSelection(['CO (ppm)', 'pH (pH)'], ['CO (ppm)', 'pH']);
    addSourceFamily('ph', '7.2', null, 'Normal');
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      ph_value: '7.2',
      ph_status: 'Normal',
      co_value: '12.5',
    });
  });

  it('honors a receipt with the frozen legacy parameter hash instead of clearing arrivals again', async () => {
    const sourceKey = createHash('sha256')
      .update(JSON.stringify([env.DB_HOST.toLowerCase(), env.DB_PORT, env.DB_NAME.toLowerCase()]))
      .digest('hex');
    // Frozen SHA-256 of ["nox","ppm"] from the original receipt contract.
    source.execute(
      `INSERT INTO ingest.parameter_measurement_cleanup_receipts
      (source_key, request_id, station_id, parameter_key, parameter_label, actor_user_id, cleared_at, table_results_json)
      VALUES (?, 101, 'S2001', ?, 'NOx (ppm)', 42, '2026-10-25T02:00:00Z', '[]')`,
      [sourceKey, '2b7501b0beabf0074a52f14e675f2e2c3014766e886b6234219e1994f84983c0'],
    );
    expect((await approve()).status).toBe(200);
    expect((await read('real')).body.data[0]).toMatchObject({
      nox_value: '88.2',
      nox_status: 'Maintenance',
      co_value: '12.5',
    });
  });

  it('rejects dedicated-unit columns whose recorded units contradict their name', async () => {
    parameterSelection(['CO (ppm)', 'CO2 (ppm)']);
    addSourceFamily('co2_ppm', '530', '%', 'Normal');
    expect((await approve()).status).toBe(503);
  });

  it('protects an approved parameter whose parenthesized unit contains only whitespace', async () => {
    parameterSelection(['CO (ppm)', 'CO2 (ppm)'], ['CO (ppm)', 'CO2 ( )']);
    addSourceFamily('co2_ppm', '530', 'ppm', 'Normal');
    expect((await approve()).status).toBe(503);
  });

  it('does not clear an approved identity sharing an entire dedicated family', async () => {
    parameterSelection(['CO (ppm)', 'CO2 (%)'], ['CO (ppm)', 'CO2 (percent)']);
    addSourceFamily('co2_percent', '0.04', null, 'Normal');
    expect((await approve()).status).toBe(503);
  });
});
