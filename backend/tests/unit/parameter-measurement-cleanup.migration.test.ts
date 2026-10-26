import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import initSqlJs, { type SqlValue } from 'sql.js';
import knex, { type Knex } from 'knex';

// The migration still executes its real source-config and schema code. Only
// opening a SQL Server connection is replaced with an isolated SQL driver.
jest.mock('knex', () => jest.fn());

import {
  down,
  up,
} from '../../src/db/migrations/0145_create_parameter_measurement_cleanup_receipts';

const realKnex = jest.requireActual<typeof knex>('knex');
const sourceConstructor = knex as unknown as jest.Mock<
  (configuration: Knex.Config | string) => Knex
>;
const primaryFixturePassword = randomUUID();
const measurementFixturePassword = randomUUID();
const primaryConnection = {
  server: 'primary.invalid',
  database: 'poms_fixture',
  port: 1433,
  user: 'primary_fixture',
  password: primaryFixturePassword,
};
const settingKeys = [
  'PARAMETER_DB_HOST',
  'PARAMETER_DB_NAME',
  'PARAMETER_DB_PORT',
  'PARAMETER_DB_USER',
  'PARAMETER_DB_PASSWORD',
  'PARAMETER_DB_SCHEMA',
  'PARAMETER_DB_ENCRYPT',
  'PARAMETER_DB_TRUST_SERVER_CERTIFICATE',
] as const;

type Row = Record<string, SqlValue>;
interface SqlStatement {
  sql: string;
  bindings?: SqlValue[];
  output?: (rows: Row[]) => unknown;
}

async function migrationSourceFixture() {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const sqlite = new SQL.Database();
  sqlite.run("ATTACH DATABASE ':memory:' AS measurement_fixture");
  sqlite.run("ATTACH DATABASE ':memory:' AS dbo");
  sqlite.run("ATTACH DATABASE ':memory:' AS INFORMATION_SCHEMA");
  sqlite.run('CREATE TABLE INFORMATION_SCHEMA.TABLES (TABLE_NAME TEXT, TABLE_SCHEMA TEXT)');
  sqlite.create_function('ISJSON', (value) => {
    if (typeof value !== 'string') return 0;
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null && typeof parsed === 'object' ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const sources: Knex[] = [];
  const configurations: Knex.Config[] = [];
  const state = { failCreate: false };
  const execute = (sql: string, bindings: SqlValue[] = []): Row[] => {
    const statement = sqlite.prepare(sql, bindings);
    const rows: Row[] = [];
    try {
      while (statement.step()) rows.push(statement.getAsObject());
    } finally {
      statement.free();
    }
    return rows;
  };
  sourceConstructor.mockImplementation((configuration: Knex.Config | string) => {
    if (typeof configuration === 'string') throw new Error('Expected a source connection config');
    configurations.push(configuration);
    const source = realKnex(configuration);
    sources.push(source);
    jest.spyOn(source.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            const compiled = (builder as { toSQL(): SqlStatement | SqlStatement[] }).toSQL();
            const run = (query: SqlStatement): unknown => {
              // SQL Server application locks and clock defaults are driver dialect
              // differences; actual lock behavior is covered by opt-in SQL tests.
              if (query.sql.includes('sp_getapplock')) return [];
              const creating = /CREATE TABLE \[([^\]]+)\]\.\[([^\]]+)\]/i.exec(query.sql);
              if (creating && state.failCreate) throw new Error('Synthetic source DDL denied');
              const sql = query.sql
                .replace(/nvarchar\(max\)/gi, 'TEXT')
                .replace(/SYSUTCDATETIME\(\)/g, 'CURRENT_TIMESTAMP');
              const rows = execute(sql, query.bindings ?? []);
              if (creating)
                execute('INSERT INTO INFORMATION_SCHEMA.TABLES VALUES (?, ?)', [
                  creating[2],
                  creating[1],
                ]);
              return query.output ? query.output(rows) : rows;
            };
            return Array.isArray(compiled)
              ? compiled.length === 1
                ? run(compiled[0])
                : compiled.map(run)
              : run(compiled);
          },
        }) as never,
    );
    const context = (source as Knex & { context: { transaction: typeof source.transaction } })
      .context;
    jest.spyOn(context, 'transaction').mockImplementation((async (callback: unknown) => {
      if (typeof callback !== 'function') throw new Error('Expected a callback transaction');
      sqlite.run('BEGIN');
      try {
        const result: unknown = await callback(source as Knex.Transaction);
        sqlite.run('COMMIT');
        return result;
      } catch (error) {
        sqlite.run('ROLLBACK');
        throw error;
      }
    }) as typeof source.transaction);
    return source;
  });
  return { sources, configurations, state, execute, close: () => sqlite.close() };
}

describe('0145 provisions durable parameter-cleanup receipts in the measurement database', () => {
  let primary: Knex;
  let fixture: Awaited<ReturnType<typeof migrationSourceFixture>>;
  let settings: Record<string, string | undefined>;

  beforeEach(async () => {
    settings = Object.fromEntries(settingKeys.map((key) => [key, process.env[key]]));
    for (const key of settingKeys) delete process.env[key];
    Object.assign(process.env, {
      PARAMETER_DB_HOST: 'measurement.invalid',
      PARAMETER_DB_NAME: 'measurement_fixture',
      PARAMETER_DB_PORT: '1434',
      PARAMETER_DB_USER: 'measurement_fixture',
      PARAMETER_DB_PASSWORD: measurementFixturePassword,
      PARAMETER_DB_SCHEMA: 'measurement_fixture',
      PARAMETER_DB_ENCRYPT: 'true',
      PARAMETER_DB_TRUST_SERVER_CERTIFICATE: 'false',
    });
    sourceConstructor.mockReset();
    primary = realKnex({
      client: 'mssql',
      connection: primaryConnection,
      pool: { min: 0, max: 1 },
    });
    fixture = await migrationSourceFixture();
  });

  afterEach(async () => {
    for (const source of fixture?.sources ?? []) await source.destroy();
    await primary?.destroy();
    fixture?.close();
    for (const key of settingKeys) {
      if (settings[key] === undefined) delete process.env[key];
      else process.env[key] = settings[key];
    }
    jest.restoreAllMocks();
  });

  it('creates the actual receipt columns in the configured source schema and closes its connection', async () => {
    await up(primary);

    expect(
      fixture
        .execute('PRAGMA measurement_fixture.table_info(parameter_measurement_cleanup_receipts)')
        .map((row) => row.name),
    ).toEqual([
      'source_key',
      'request_id',
      'station_id',
      'parameter_key',
      'parameter_label',
      'actor_user_id',
      'cleared_at',
      'table_results_json',
    ]);
    expect(fixture.configurations[0]).toMatchObject({
      client: 'mssql',
      connection: {
        server: 'measurement.invalid',
        database: 'measurement_fixture',
        port: 1434,
        user: 'measurement_fixture',
        password: measurementFixturePassword,
        options: { encrypt: true, trustServerCertificate: false },
      },
      pool: { min: 0, max: 1 },
    });
    expect(fixture.sources[0].client.pool).toBeUndefined();
    expect(primary.client.pool).toBeDefined();
  });

  it('retains existing receipts and measurements through reruns and migration rollback', async () => {
    fixture.execute('CREATE TABLE measurement_fixture.S1_data_real (co_value TEXT)');
    fixture.execute("INSERT INTO measurement_fixture.S1_data_real VALUES ('12.5')");
    await up(primary);
    fixture.execute(
      `INSERT INTO measurement_fixture.parameter_measurement_cleanup_receipts
      (source_key, request_id, station_id, parameter_key, parameter_label, actor_user_id, cleared_at, table_results_json)
      VALUES (?, 101, 'S1', ?, 'CO (ppm)', 42, '2026-10-26T03:00:00.000Z', '[]')`,
      ['a'.repeat(64), 'b'.repeat(64)],
    );

    await up(primary);
    await down();

    expect(
      fixture.execute(
        'SELECT request_id, station_id, parameter_label, cleared_at FROM measurement_fixture.parameter_measurement_cleanup_receipts',
      ),
    ).toEqual([
      {
        request_id: 101,
        station_id: 'S1',
        parameter_label: 'CO (ppm)',
        cleared_at: '2026-10-26T03:00:00.000Z',
      },
    ]);
    expect(fixture.execute('SELECT co_value FROM measurement_fixture.S1_data_real')).toEqual([
      { co_value: '12.5' },
    ]);
    expect(fixture.sources.every((source) => source.client.pool === undefined)).toBe(true);
  });

  it('enforces the request-and-parameter receipt key and JSON results constraint', async () => {
    await up(primary);
    const insert = `INSERT INTO measurement_fixture.parameter_measurement_cleanup_receipts
      (source_key, request_id, station_id, parameter_key, parameter_label, actor_user_id, table_results_json)
      VALUES (?, ?, 'S1', ?, 'CO (ppm)', 42, ?)`;
    fixture.execute(insert, ['a'.repeat(64), 101, 'b'.repeat(64), '[]']);

    expect(() => fixture.execute(insert, ['a'.repeat(64), 101, 'b'.repeat(64), '[]'])).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() =>
      fixture.execute(insert, ['a'.repeat(64), 102, 'b'.repeat(64), 'not-json']),
    ).toThrow(/CHECK constraint failed/);
    fixture.execute(insert, ['a'.repeat(64), 102, 'b'.repeat(64), '[]']);

    expect(
      fixture.execute(
        'SELECT request_id FROM measurement_fixture.parameter_measurement_cleanup_receipts ORDER BY request_id',
      ),
    ).toEqual([{ request_id: 101 }, { request_id: 102 }]);
    const key = fixture
      .execute('PRAGMA measurement_fixture.table_info(parameter_measurement_cleanup_receipts)')
      .filter((column) => Number(column.pk) > 0)
      .sort((left, right) => Number(left.pk) - Number(right.pk))
      .map((column) => column.name);
    expect(key).toEqual(['source_key', 'request_id', 'station_id', 'parameter_key']);
  });

  it('releases the source connection when provisioning fails and allows a clean retry', async () => {
    fixture.state.failCreate = true;
    await expect(up(primary)).rejects.toThrow('Synthetic source DDL denied');
    expect(fixture.sources[0].client.pool).toBeUndefined();
    expect(primary.client.pool).toBeDefined();

    fixture.state.failCreate = false;
    await up(primary);
    expect(
      fixture.execute(
        'PRAGMA measurement_fixture.table_info(parameter_measurement_cleanup_receipts)',
      ),
    ).toHaveLength(8);
  });

  it('uses the primary migration connection and dbo only when source settings are absent', async () => {
    for (const key of settingKeys) delete process.env[key];
    await up(primary);

    expect(fixture.configurations[0]).toMatchObject({ connection: primaryConnection });
    expect(
      fixture.execute('SELECT TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?', [
        'parameter_measurement_cleanup_receipts',
      ]),
    ).toEqual([{ TABLE_SCHEMA: 'dbo' }]);
    expect(fixture.sources[0].client.pool).toBeUndefined();
  });
});
