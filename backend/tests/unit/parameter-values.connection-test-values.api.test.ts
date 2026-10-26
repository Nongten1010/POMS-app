import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const originalMode = env.FACTORY_PROFILE_MODE;
const originalSchema = env.PARAMETER_DB_SCHEMA;
const path = '/api/v1/parameter-values/connection-test?stationId=S2007';
let primary: KnexSqliteFixture;
let source: KnexSqliteFixture;
let token: string;

describe('connection-test measured values through the API', () => {
  beforeEach(async () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    env.PARAMETER_DB_SCHEMA = 'ingest';
    primary = await createKnexSqliteFixture(
      db,
      {
        users: [
          {
            id: 42,
            external_id: 'measurement_reader',
            identity_provider: 'local',
            user_type: 'operator',
            username: 'measurement_reader',
            first_name: 'Test',
            last_name: 'Reader',
            is_active: true,
            permission_mode: 'role_default',
            deleted_at: null,
          },
        ],
        user_roles: [{ user_id: 42, role_id: 1 }],
        roles: [{ id: 1, code: 'factory_operator', deleted_at: null }],
        permissions: [{ id: 1, code: 'cems_wpms_requests:view' }],
        role_permissions: [{ role_id: 1, permission_id: 1, scope: 'ALL' }],
        cems_wpms_connected_measurement_points: [
          {
            id: 7,
            point_code: 'S2007',
            point_name: 'Stack 7',
            parameters_json: JSON.stringify(['CO (ppm)', 'NOx (ppm)', 'O2 (%)']),
            instruments_json: null,
            deleted_at: null,
          },
        ],
        device_connection_configs: [
          {
            id: 1,
            station_id: 'S2007',
            protocol: 'MODBUS_TCP',
            request_id: null,
            deleted_at: null,
          },
        ],
        device_measurement_channels: [
          {
            id: 1,
            config_id: 1,
            data_type: 'CO (ppm)',
            test_mode: true,
            deleted_at: null,
          },
        ],
      },
      {
        user_permissions: [
          'user_id',
          'permission_id',
          'scope',
          'effect',
          'region_name',
          'province_id',
          'estate_code',
        ],
        provinces: ['id', 'name_th'],
        cems_wpms_connection_requests: ['id', 'status', 'deleted_at'],
        cems_wpms_measurement_points: [
          'id',
          'request_id',
          'point_code',
          'point_name',
          'parameters_json',
          'instruments_json',
          'deleted_at',
        ],
      },
    );
    source = await createKnexSqliteFixture(parameterSourceDb, { fixture: [{ id: 1 }] });
    source.execute("ATTACH DATABASE ':memory:' AS sys");
    source.execute("ATTACH DATABASE ':memory:' AS ingest");
    source.execute('CREATE TABLE sys.schemas (schema_id INTEGER, name TEXT)');
    source.execute('CREATE TABLE sys.tables (schema_id INTEGER, object_id INTEGER, name TEXT)');
    source.execute("INSERT INTO sys.schemas VALUES (1, 'ingest')");
    source.execute("INSERT INTO sys.tables VALUES (1, 7, 'S2007_data_real')");
    source.execute(`CREATE TABLE ingest.S2007_data_real (
      cdate TEXT, ctime TEXT,
      co_value, co_status,
      nox_value, nox_status,
      o2_value, o2_status,
      so2_value, so2_status
    )`);
    token = signAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: { 'cems_wpms_requests:view': 'ALL' },
    });
  });

  afterEach(() => {
    source?.close();
    primary?.close();
    env.FACTORY_PROFILE_MODE = originalMode;
    env.PARAMETER_DB_SCHEMA = originalSchema;
  });

  it('keeps the measured value alongside an operational status', async () => {
    source.execute(
      `INSERT INTO ingest.S2007_data_real
       (cdate, ctime, co_value, co_status, nox_value, nox_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['2026-10-26', '10:15:00', '12.5', 'Normal', '88.2', 'Maintenance'],
    );

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        timestamp: '2026-10-26 10:15:00',
        values: { 'CO (ppm)': '12.5', 'NOx (ppm)': '88.2', 'O2 (%)': null },
        statuses: { 'CO (ppm)': 'Normal', 'NOx (ppm)': 'Maintenance', 'O2 (%)': null },
      },
    ]);
    expect(response.body.meta).toMatchObject({ interval: 'real', tableName: 'S2007_data_real' });
  });

  it('returns measured PM2.5 values and statuses from underscore column names', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['PM2.5 (µg/m3)']),
    ]);
    source.execute('ALTER TABLE ingest.S2007_data_real ADD COLUMN pm2_5_value');
    source.execute('ALTER TABLE ingest.S2007_data_real ADD COLUMN pm2_5_status');
    source.execute('ALTER TABLE ingest.S2007_data_real ADD COLUMN pm2_5_units');
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, pm2_5_value, pm2_5_status, pm2_5_units)
      VALUES ('2026-10-26', '10:15:00', '45.6', 'Maintenance', 'µg/m3')`);

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'PM2.5 (µg/m3)': '45.6' },
      statuses: { 'PM2.5 (µg/m3)': 'Maintenance' },
    });
  });

  it('does not copy a generic CO2 ppm measurement into the percent parameter', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['CO2 (%)', 'CO2 (ppm)']),
    ]);
    for (const suffix of ['value', 'status', 'units'])
      source.execute(`ALTER TABLE ingest.S2007_data_real ADD COLUMN co2_${suffix}`);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status, co2_units)
      VALUES ('2026-10-26', '10:15:00', '123.4', 'Maintenance', 'ppm')`);

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (%)': null, 'CO2 (ppm)': '123.4' },
      statuses: { 'CO2 (%)': null, 'CO2 (ppm)': 'Maintenance' },
    });
  });

  it('does not guess between two populated generic families for the same parameter', async () => {
    primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
      JSON.stringify(['Flow Rate (m3/hr)']),
    ]);
    for (const prefix of ['flow', 'flow_rate'])
      for (const suffix of ['value', 'status', 'units'])
        source.execute(`ALTER TABLE ingest.S2007_data_real ADD COLUMN ${prefix}_${suffix}`);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, flow_value, flow_status, flow_units, flow_rate_value, flow_rate_status, flow_rate_units)
      VALUES ('2026-10-26', '10:15:00', '100', 'Normal', 'm3/hr', '200', 'Maintenance', 'm3/hr')`);

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'Flow Rate (m3/hr)': null },
      statuses: { 'Flow Rate (m3/hr)': null },
    });
  });

  it('prefers the dedicated unit families while keeping each value with its own status', async () => {
    registerParameters(['CO2 (%)', 'CO2 (ppm)']);
    addFamilies(['co2', 'co2_ppm', 'co2_percent']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status, co2_units,
       co2_ppm_value, co2_ppm_status, co2_ppm_units,
       co2_percent_value, co2_percent_status, co2_percent_units)
      VALUES ('2026-10-26', '10:15:00', '777', 'Normal', 'ppm',
        '530', 'Maintenance', 'ppm', '10.4', 'Calibration', '%')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (%)': '10.4', 'CO2 (ppm)': '530' },
      statuses: { 'CO2 (%)': 'Calibration', 'CO2 (ppm)': 'Maintenance' },
    });
  });

  it('keeps a dedicated status with its null value instead of borrowing a generic value', async () => {
    registerParameters(['CO2 (ppm)']);
    addFamilies(['co2', 'co2_ppm']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status, co2_units, co2_ppm_status, co2_ppm_units)
      VALUES ('2026-10-26', '10:15:00', '777', 'Normal', 'ppm', 'Defective', 'ppm')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (ppm)': null },
      statuses: { 'CO2 (ppm)': 'Defective' },
    });
  });

  it('does not borrow a generic status for the populated dedicated value', async () => {
    registerParameters(['CO2 (ppm)']);
    addFamilies(['co2', 'co2_ppm']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status, co2_units, co2_ppm_value, co2_ppm_units)
      VALUES ('2026-10-26', '10:15:00', '777', 'Normal', 'ppm', '530', 'ppm')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (ppm)': '530' },
      statuses: { 'CO2 (ppm)': null },
    });
  });

  it('uses a unit-matching generic pair when the dedicated pair has no data', async () => {
    registerParameters(['CO2 (ppm)']);
    addFamilies(['co2', 'co2_ppm']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status, co2_units, co2_ppm_units)
      VALUES ('2026-10-26', '10:15:00', 0, 'Maintenance', 'ppm', 'ppm')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (ppm)': 0 },
      statuses: { 'CO2 (ppm)': 'Maintenance' },
    });
  });

  it('does not infer a generic unit when two registered units are possible', async () => {
    registerParameters(['CO2 (%)', 'CO2 (ppm)']);
    addFamilies(['co2']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status)
      VALUES ('2026-10-26', '10:15:00', '530', 'Maintenance')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (%)': null, 'CO2 (ppm)': null },
      statuses: { 'CO2 (%)': null, 'CO2 (ppm)': null },
    });
  });

  it('does not infer a generic unit when another unit-specific source family exists', async () => {
    registerParameters(['CO2 (ppm)']);
    addFamilies(['co2', 'co2_percent']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2_value, co2_status)
      VALUES ('2026-10-26', '10:15:00', '530', 'Maintenance')`);
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (ppm)': null },
      statuses: { 'CO2 (ppm)': null },
    });
  });

  it('does not read the unrelated COD family as a compact CO unit family', async () => {
    registerParameters(['CO (d)']);
    addFamilies(['cod']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, cod_value, cod_status)
      VALUES ('2026-10-26', '10:15:00', '45', 'Normal')`);

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO (d)': null },
      statuses: { 'CO (d)': null },
    });
  });

  it('keeps the documented compact CO2 ppm and percent families', async () => {
    registerParameters(['CO2 (ppm)', 'CO2 (%)']);
    addFamilies(['co2ppm', 'co2percent']);
    source.execute(`INSERT INTO ingest.S2007_data_real
      (cdate, ctime, co2ppm_value, co2ppm_status, co2percent_value, co2percent_status)
      VALUES ('2026-10-26', '10:15:00', '530', 'Maintenance', '10.4', 'Calibration')`);

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { 'CO2 (ppm)': '530', 'CO2 (%)': '10.4' },
      statuses: { 'CO2 (ppm)': 'Maintenance', 'CO2 (%)': 'Calibration' },
    });
  });

  it.each([null, '', 'pH'])('reads dimensionless pH with source unit %s', async (unit) => {
    registerParameters(['pH']);
    addFamilies(['ph']);
    source.execute(
      `INSERT INTO ingest.S2007_data_real
      (cdate, ctime, ph_value, ph_status, ph_units)
      VALUES ('2026-10-26', '10:15:00', '7.2', 'Normal', ?)`,
      [unit],
    );
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      values: { pH: '7.2' },
      statuses: { pH: 'Normal' },
    });
  });

  it.each([
    [0, 'NoData'],
    [1, 'Ok'],
    [2, 'Calibration'],
    [3, 'Defective'],
    [4, 'Maintenance'],
    [5, 'Start up'],
    [6, 'Shut Down'],
    [7, 'Turnaround'],
    [8, 'Etc.'],
    [9, 'No Discharge'],
  ])('returns the original numeric zero with status code %s (%s)', async (code, label) => {
    source.execute(
      `INSERT INTO ingest.S2007_data_real (cdate, ctime, co_value, co_status)
       VALUES ('2026-10-26', '10:15:00', 0, ?)`,
      [code],
    );

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0].values['CO (ppm)']).toBe(0);
    expect(response.body.data[0].statuses['CO (ppm)']).toBe(label);
  });

  it('returns null for a missing value while keeping its available status', async () => {
    source.execute(
      `INSERT INTO ingest.S2007_data_real (cdate, ctime, nox_status)
       VALUES ('2026-10-26', '10:15:00', 'Defective')`,
    );

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0].values['NOx (ppm)']).toBeNull();
    expect(response.body.data[0].statuses['NOx (ppm)']).toBe('Defective');
  });

  it('keeps raw text values and excludes unregistered parameters', async () => {
    source.execute(
      `INSERT INTO ingest.S2007_data_real
       (cdate, ctime, co_value, co_status, so2_value, so2_status)
       VALUES ('2026-10-26', '10:15:00', '0012.50', 'Maintenance', 999, 'Normal')`,
    );

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data[0].values).toEqual({
      'CO (ppm)': '0012.50',
      'NOx (ppm)': null,
      'O2 (%)': null,
    });
    expect(response.body.data[0].statuses).toEqual({
      'CO (ppm)': 'Maintenance',
      'NOx (ppm)': null,
      'O2 (%)': null,
    });
  });

  it.each([
    ['MODBUS_RTU', 'real', '12.5'],
    ['MODBUS_TCP', 'real', '12.5'],
    ['DCON_ASCII', 'real', '12.5'],
    ['POMS_BOX', '1m', '45.6'],
    ['MSSQL', '1m', '45.6'],
    ['MYSQL', '1m', '45.6'],
  ])(
    'reads the %s protocol from %s rather than the test table',
    async (protocol, interval, value) => {
      primary.execute('UPDATE device_connection_configs SET protocol = ?', [protocol]);
      createMinuteTable();
      source.execute("INSERT INTO sys.tables VALUES (1, 9, 'S2007_data_test')");
      source.execute('CREATE TABLE ingest.S2007_data_test (cdate TEXT, ctime TEXT, co_value)');
      source.execute("INSERT INTO ingest.S2007_data_test VALUES ('2026-10-26', '10:15:00', '999')");
      source.execute(
        `INSERT INTO ingest.S2007_data_real (cdate, ctime, co_value, co_status)
       VALUES ('2026-10-26', '10:15:00', '12.5', 'Maintenance')`,
      );

      const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

      expect(response.status).toBe(200);
      expect(response.body.meta.interval).toBe(interval);
      expect(response.body.data[0].values['CO (ppm)']).toBe(value);
      expect(response.body.data[0].statuses['CO (ppm)']).toBe('Maintenance');
    },
  );

  it('uses one-minute rows when no saved device config exists', async () => {
    primary.execute('DELETE FROM device_connection_configs');
    createMinuteTable();

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.meta.interval).toBe('1m');
    expect(response.body.data[0].values['CO (ppm)']).toBe('45.6');
  });

  it('uses realtime rows when saved devices include both realtime and one-minute protocols', async () => {
    primary.execute(
      `INSERT INTO device_connection_configs (id, station_id, protocol, request_id, deleted_at)
       VALUES (2, 'S2007', 'MYSQL', NULL, NULL)`,
    );
    createMinuteTable();
    source.execute(
      `INSERT INTO ingest.S2007_data_real (cdate, ctime, co_value, co_status)
       VALUES ('2026-10-26', '10:15:00', '12.5', 'Maintenance')`,
    );

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.meta.interval).toBe('real');
    expect(response.body.data[0].values['CO (ppm)']).toBe('12.5');
  });

  it('returns at most ten newest source rows without changing their timestamps', async () => {
    for (let minute = 1; minute <= 12; minute++) {
      source.execute(
        `INSERT INTO ingest.S2007_data_real (cdate, ctime, co_value, co_status)
         VALUES ('2026-10-26', ?, ?, 'Maintenance')`,
        [`10:${String(minute).padStart(2, '0')}:00`, minute],
      );
    }

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.meta.count).toBe(10);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.data[0]).toMatchObject({
      timestamp: '2026-10-26 10:12:00',
      values: { 'CO (ppm)': 12 },
    });
    expect(response.body.data[9]).toMatchObject({
      timestamp: '2026-10-26 10:03:00',
      values: { 'CO (ppm)': 3 },
    });
  });

  it('reports a missing selected realtime table without falling back to one-minute rows', async () => {
    createMinuteTable();
    source.execute("DELETE FROM sys.tables WHERE name = 'S2007_data_real'");

    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns an empty collection when the selected table has no rows', async () => {
    const response = await request(createApp()).get(path).auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.count).toBe(0);
  });
});

function registerParameters(parameters: string[]): void {
  primary.execute('UPDATE cems_wpms_connected_measurement_points SET parameters_json = ?', [
    JSON.stringify(parameters),
  ]);
}

function addFamilies(prefixes: string[]): void {
  for (const prefix of prefixes)
    for (const suffix of ['value', 'status', 'units'])
      source.execute(`ALTER TABLE ingest.S2007_data_real ADD COLUMN ${prefix}_${suffix}`);
}

function createMinuteTable(): void {
  source.execute("INSERT INTO sys.tables VALUES (1, 8, 'S2007_data_1m')");
  source.execute('CREATE TABLE ingest.S2007_data_1m (cdate TEXT, ctime TEXT, co_value, co_status)');
  source.execute(
    `INSERT INTO ingest.S2007_data_1m VALUES
     ('2026-10-26', '10:15:00', '45.6', 'Maintenance')`,
  );
}
