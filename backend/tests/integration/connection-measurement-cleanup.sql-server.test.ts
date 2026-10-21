import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import knex, { type Knex } from 'knex';

jest.mock('../../src/config/parameter-source-database', () => ({ parameterSourceDb: {} }));
jest.mock('../../src/config/env', () => ({
  env: {
    DB_HOST: 'fixture.invalid',
    DB_PORT: 1433,
    DB_NAME: 'cleanup_fixture',
    PARAMETER_DB_SCHEMA: '',
  },
}));
jest.mock('../../src/config/logger', () => ({ logger: { error: jest.fn() } }));

import { env } from '../../src/config/env';
import {
  clearNewConnectionMeasurements,
  CONNECTION_CLEANUP_INTERVALS,
} from '../../src/modules/connection-requests/connection-measurement-cleanup';
import {
  cleanupSqlIdentifier,
  createMeasurementCleanupReceipts,
  MEASUREMENT_CLEANUP_RECEIPTS_TABLE,
} from '../../src/modules/connection-requests/connection-measurement-cleanup-schema';

// Opt-in with dedicated credentials only; never fall back to application DB_*.
const enabled = process.env.POMS_CLEANUP_SQL_TEST_ENABLED;
if (enabled !== undefined && !['true', 'false'].includes(enabled)) {
  throw new Error('POMS_CLEANUP_SQL_TEST_ENABLED must be true or false');
}
const sqlDescribe = enabled === 'true' ? describe : describe.skip;

sqlDescribe('measurement cleanup on an isolated SQL Server', () => {
  let database: Knex;
  let schemaCreated = false;
  const schema = `cleanup_${randomUUID().replace(/-/g, '')}`;
  const createdTables: string[] = [];
  const primary = (() => ({
    whereRaw: () => ({ first: async () => undefined }),
  })) as unknown as Knex.Transaction;
  const qualified = (table: string) =>
    `${cleanupSqlIdentifier(schema)}.${cleanupSqlIdentifier(table)}`;
  const statement = (sql: string) => database.raw('EXEC sys.sp_executesql ?', [sql]);
  const input = (stationId: string) => ({
    requestId: 10,
    requestType: 'ADD_MEASUREMENT_POINT' as const,
    measurementPoints: [{ pointCode: stationId }],
    actorUserId: 42,
  });
  const count = async (table: string) =>
    Number((await statement(`SELECT COUNT_BIG(*) AS total FROM ${qualified(table)}`))[0].total);

  beforeAll(async () => {
    const settings = process.env;
    const target = settings.POMS_CLEANUP_SQL_TEST_DATABASE;
    if (
      target !== 'poms_measurement_cleanup_test' ||
      !settings.POMS_CLEANUP_SQL_TEST_HOST ||
      !settings.POMS_CLEANUP_SQL_TEST_USER ||
      !settings.POMS_CLEANUP_SQL_TEST_PASSWORD
    ) {
      throw new Error(
        'Explicit POMS_CLEANUP_SQL_TEST credentials for poms_measurement_cleanup_test are required',
      );
    }
    const port = Number(settings.POMS_CLEANUP_SQL_TEST_PORT ?? 1433);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid SQL test port');
    database = knex({
      client: 'mssql',
      connection: {
        server: settings.POMS_CLEANUP_SQL_TEST_HOST,
        database: target,
        port,
        user: settings.POMS_CLEANUP_SQL_TEST_USER,
        password: settings.POMS_CLEANUP_SQL_TEST_PASSWORD,
        options: { encrypt: false, trustServerCertificate: true },
      },
      pool: { min: 0, max: 4 },
    });
    const [identity] = await database.raw(`
      SELECT DB_NAME() AS database_name,
        (SELECT CONVERT(nvarchar(200), value) FROM sys.extended_properties
         WHERE class = 0 AND name = N'PomsTestPurpose') AS purpose
    `);
    if (
      identity.database_name !== target ||
      identity.purpose !== 'measurement-cleanup-synthetic-only'
    ) {
      throw new Error('Dedicated synthetic measurement cleanup database required');
    }
    await database.schema.createSchema(schema);
    schemaCreated = true;
    env.PARAMETER_DB_SCHEMA = schema;
    await createMeasurementCleanupReceipts(database, schema);
    for (const station of ['จุด.01?]', 'P2001', 'unrelated']) {
      for (const interval of CONNECTION_CLEANUP_INTERVALS) {
        const table = `${station}_data_${interval}`;
        await statement(`CREATE TABLE ${qualified(table)} (sample nvarchar(40) NULL)`);
        createdTables.push(table);
        await statement(`INSERT INTO ${qualified(table)} VALUES (N'test-before-cutoff')`);
      }
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (schemaCreated) {
        for (const table of createdTables) await statement(`DROP TABLE ${qualified(table)}`);
        await statement(`DROP TABLE ${qualified(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)}`);
        await database.schema.dropSchema(schema);
      }
    } finally {
      if (database) await database.destroy();
    }
  }, 60000);

  it('blocks concurrent inserts until cleanup commits and preserves them through retries', async () => {
    const station = 'จุด.01?]';
    let insertFinished = false;
    let writer: Promise<unknown> | undefined;
    const source = {
      transaction: (callback: (trx: Knex.Transaction) => Promise<void>) =>
        database.transaction(async (trx) => {
          const wrapped = {
            raw: async (sql: string, bindings?: Knex.RawBinding[]) => {
              if (sql === 'SELECT SYSUTCDATETIME() AS cleared_at') {
                writer = statement(
                  `INSERT INTO ${qualified(`${station}_data_real`)} VALUES (N'arrived-after-cutoff')`,
                ).then(() => {
                  insertFinished = true;
                });
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(insertFinished).toBe(false);
              }
              return bindings ? trx.raw(sql, bindings) : trx.raw(sql);
            },
          } as unknown as Knex.Transaction;
          await callback(wrapped);
        }),
    } as unknown as Knex;
    await clearNewConnectionMeasurements(primary, input(station), source);
    await writer;
    expect(insertFinished).toBe(true);
    expect(await count(`${station}_data_real`)).toBe(1);
    for (const interval of CONNECTION_CLEANUP_INTERVALS.slice(1))
      expect(await count(`${station}_data_${interval}`)).toBe(0);
    expect(await count('unrelated_data_real')).toBe(1);
    await clearNewConnectionMeasurements(primary, { ...input(station), requestId: 999 }, database);
    expect(await count(`${station}_data_real`)).toBe(1);
  }, 30000);

  it('rolls back earlier deletions and receipts when a later table fails', async () => {
    let deletes = 0;
    const source = {
      transaction: (callback: (trx: Knex.Transaction) => Promise<void>) =>
        database.transaction(async (trx) => {
          await callback({
            raw: (sql: string, bindings?: Knex.RawBinding[]) => {
              if (String(bindings?.[0]).startsWith('DELETE FROM') && ++deletes === 2) {
                throw new Error('synthetic deletion failure');
              }
              return bindings ? trx.raw(sql, bindings) : trx.raw(sql);
            },
          } as unknown as Knex.Transaction);
        }),
    } as unknown as Knex;
    await expect(
      clearNewConnectionMeasurements(primary, input('P2001'), source),
    ).rejects.toMatchObject({
      code: 'MEASUREMENT_CLEANUP_FAILED',
      statusCode: 503,
    });
    for (const interval of CONNECTION_CLEANUP_INTERVALS)
      expect(await count(`P2001_data_${interval}`)).toBe(1);
    const receipts = await database.raw(
      `SELECT station_id FROM ${qualified(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)} WHERE station_id = ?`,
      ['P2001'],
    );
    expect(receipts).toEqual([]);
  }, 30000);
});
