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
import {
  createParameterMeasurementCleanupReceipts,
  PARAMETER_CLEANUP_RECEIPTS_TABLE,
} from '../../src/modules/connection-requests/parameter-measurement-cleanup-schema';
import { down as retainParameterCleanupReceipts } from '../../src/db/migrations/0145_create_parameter_measurement_cleanup_receipts';
import { clearAddedParameterMeasurements } from '../../src/modules/connection-requests/added-parameter-measurement-cleanup';

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
  const addedInput = (stationId: string, requestId: number, added = 'CO2 (ppm)') => ({
    requestId,
    actorUserId: 42,
    points: [
      {
        stationId,
        requestedParameters: ['CO (ppm)', 'CO2 (%)', added],
        connectedParametersJson: JSON.stringify(['CO (ppm)', 'CO2 (%)']),
      },
    ],
  });

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
    await statement(`CREATE SCHEMA ${cleanupSqlIdentifier(schema)}`);
    schemaCreated = true;
    env.PARAMETER_DB_SCHEMA = schema;
    await createMeasurementCleanupReceipts(database, schema);
    await createParameterMeasurementCleanupReceipts(database, schema);
    for (const station of ['จุด.01?]', 'P2001', 'unrelated']) {
      for (const interval of CONNECTION_CLEANUP_INTERVALS) {
        const table = `${station}_data_${interval}`;
        await statement(`CREATE TABLE ${qualified(table)} (sample nvarchar(40) NULL)`);
        createdTables.push(table);
        await statement(`INSERT INTO ${qualified(table)} VALUES (N'test-before-cutoff')`);
      }
    }
    for (const station of ['S9901', 'S9902', 'S9903', 'S9904', 'S9905', 'S9906', 'S9907']) {
      for (const interval of CONNECTION_CLEANUP_INTERVALS) {
        const table = `${station}_data_${interval}`;
        await statement(`CREATE TABLE ${qualified(table)} (
          station_id nvarchar(64) NOT NULL, cdate date NULL, ctime time(0) NULL,
          co_value nvarchar(20) NULL, co_units nvarchar(32) NULL, co_status nvarchar(64) NULL,
          co2_value nvarchar(20) NULL, co2_units nvarchar(32) NULL, co2_status nvarchar(64) NULL,
          co2_ppm_value nvarchar(20) NULL, co2_ppm_units nvarchar(32) NULL, co2_ppm_status nvarchar(64) NULL,
          co2_percent_value nvarchar(20) NULL, co2_percent_units nvarchar(32) NULL, co2_percent_status nvarchar(64) NULL,
          ph_value nvarchar(20) NULL, ph_units nvarchar(32) NULL, ph_status nvarchar(64) NULL
        )`);
        createdTables.push(table);
        await statement(`INSERT INTO ${qualified(table)} VALUES (
          N'${station}', '2026-10-25', '10:15:00',
          N'12.5', N'ppm', N'Normal', N'530', N'ppm', N'Maintenance',
          N'530', N'ppm', N'Maintenance', N'10.4', N'%', N'Normal', N'7.2', NULL, N'Normal'
        )`);
      }
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (schemaCreated) {
        for (const table of createdTables) await statement(`DROP TABLE ${qualified(table)}`);
        await statement(`DROP TABLE ${qualified(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)}`);
        await statement(`DROP TABLE ${qualified(PARAMETER_CLEANUP_RECEIPTS_TABLE)}`);
        await statement(`DROP SCHEMA ${cleanupSqlIdentifier(schema)}`);
      }
    } finally {
      if (database) await database.destroy();
    }
  }, 60000);

  it('provisions parameter receipts idempotently with real primary-key and JSON constraints', async () => {
    await createParameterMeasurementCleanupReceipts(database, schema);
    const receipt = {
      source_key: 'a'.repeat(64),
      request_id: 900,
      station_id: 'schema-check',
      parameter_key: 'b'.repeat(64),
      parameter_label: 'CO2 (ppm)',
      actor_user_id: 42,
      table_results_json: '[]',
    };
    await database.withSchema(schema).table(PARAMETER_CLEANUP_RECEIPTS_TABLE).insert(receipt);
    await expect(
      database.withSchema(schema).table(PARAMETER_CLEANUP_RECEIPTS_TABLE).insert(receipt),
    ).rejects.toThrow();
    await expect(
      database
        .withSchema(schema)
        .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
        .insert({
          ...receipt,
          parameter_key: 'c'.repeat(64),
          table_results_json: 'invalid-json',
        }),
    ).rejects.toThrow();
    await createParameterMeasurementCleanupReceipts(database, schema);
    await retainParameterCleanupReceipts();
    const rows = await database
      .withSchema(schema)
      .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
      .where('station_id', 'schema-check')
      .select('parameter_label', 'table_results_json');
    expect(rows).toEqual([{ parameter_label: 'CO2 (ppm)', table_results_json: '[]' }]);
  });

  it('clears every matching ppm family in all six intervals while preserving percent and other parameters', async () => {
    await statement(`UPDATE ${qualified('S9901_data_5m')}
      SET co2_value = NULL, co2_status = NULL`);
    await clearAddedParameterMeasurements(addedInput('S9901', 1001), database);
    for (const interval of CONNECTION_CLEANUP_INTERVALS) {
      const rows = await statement(`SELECT station_id, CONVERT(varchar(10), cdate, 23) AS cdate,
        CONVERT(varchar(8), ctime, 108) AS ctime, co_value, co_status,
        co2_value, co2_units, co2_status, co2_ppm_value, co2_ppm_units, co2_ppm_status,
        co2_percent_value, co2_percent_units, co2_percent_status, ph_value, ph_units, ph_status
        FROM ${qualified(`S9901_data_${interval}`)}`);
      expect(rows).toEqual([
        {
          station_id: 'S9901',
          cdate: '2026-10-25',
          ctime: '10:15:00',
          co_value: '12.5',
          co_status: 'Normal',
          co2_value: null,
          co2_units: 'ppm',
          co2_status: null,
          co2_ppm_value: null,
          co2_ppm_units: 'ppm',
          co2_ppm_status: null,
          co2_percent_value: '10.4',
          co2_percent_units: '%',
          co2_percent_status: 'Normal',
          ph_value: '7.2',
          ph_units: null,
          ph_status: 'Normal',
        },
      ]);
    }
  });

  it('clears dimensionless pH without requiring a fabricated unit', async () => {
    await statement(`UPDATE ${qualified('S9904_data_1m')} SET ph_units = N''`);
    await clearAddedParameterMeasurements(addedInput('S9904', 1004, 'pH'), database);
    for (const interval of CONNECTION_CLEANUP_INTERVALS) {
      const rows = await statement(`SELECT co_value, co_status, co2_ppm_value, co2_percent_value,
        ph_value, ph_units, ph_status FROM ${qualified(`S9904_data_${interval}`)}`);
      expect(rows).toEqual([
        {
          co_value: '12.5',
          co_status: 'Normal',
          co2_ppm_value: '530',
          co2_percent_value: '10.4',
          ph_value: null,
          ph_units: interval === '1m' ? '' : null,
          ph_status: null,
        },
      ]);
    }
  });

  it('blocks concurrent parameter inserts until cleanup commits and keeps them on retry', async () => {
    let inserted = false;
    let writer: Promise<unknown> | undefined;
    const source = {
      transaction: (callback: (trx: Knex.Transaction) => Promise<void>) =>
        database.transaction(async (trx) => {
          await callback({
            raw: async (sql: string, bindings?: Knex.RawBinding[]) => {
              if (sql === 'SELECT SYSUTCDATETIME() AS cleared_at') {
                writer = statement(`INSERT INTO ${qualified('S9902_data_real')}
                  (station_id, cdate, ctime, co_value, co_units, co_status,
                   co2_value, co2_units, co2_status, co2_ppm_value, co2_ppm_units, co2_ppm_status)
                  VALUES (N'S9902', '2026-01-01', '09:00:00', N'18', N'ppm', N'Normal',
                    N'777', N'ppm', N'Normal', N'777', N'ppm', N'Normal')`).then(() => {
                  inserted = true;
                });
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(inserted).toBe(false);
              }
              return bindings ? trx.raw(sql, bindings) : trx.raw(sql);
            },
          } as unknown as Knex.Transaction);
        }),
    } as unknown as Knex;
    const input = addedInput('S9902', 1002);
    await clearAddedParameterMeasurements(input, source);
    if (!writer) throw new Error('Concurrent parameter writer was not started');
    await writer;
    expect(inserted).toBe(true);
    expect(await count('S9902_data_real')).toBe(2);
    await clearAddedParameterMeasurements(input, database);
    const afterRetry = await statement(`SELECT co_value, co2_value, co2_ppm_value,
      co2_status, co2_ppm_status FROM ${qualified('S9902_data_real')}
      WHERE cdate = '2026-01-01'`);
    expect(afterRetry).toEqual([
      {
        co_value: '18',
        co2_value: '777',
        co2_ppm_value: '777',
        co2_status: 'Normal',
        co2_ppm_status: 'Normal',
      },
    ]);
  }, 30000);

  it('rolls back every parameter family and receipt when a later interval rejects an update', async () => {
    const trigger = qualified('deny_parameter_cleanup');
    await statement(`CREATE TRIGGER ${trigger} ON ${qualified('S9903_data_1m')}
      INSTEAD OF UPDATE AS BEGIN THROW 51001, 'Synthetic parameter cleanup denial', 1; END`);
    const input = addedInput('S9903', 1003);
    try {
      await expect(clearAddedParameterMeasurements(input, database)).rejects.toMatchObject({
        statusCode: 503,
        code: 'MEASUREMENT_CLEANUP_FAILED',
      });
      for (const interval of CONNECTION_CLEANUP_INTERVALS) {
        const rows = await statement(`SELECT co_value, co2_value, co2_ppm_value,
          co2_percent_value FROM ${qualified(`S9903_data_${interval}`)}`);
        expect(rows).toEqual([
          {
            co_value: '12.5',
            co2_value: '530',
            co2_ppm_value: '530',
            co2_percent_value: '10.4',
          },
        ]);
      }
      expect(
        await database
          .withSchema(schema)
          .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
          .where('request_id', 1003)
          .select('parameter_key'),
      ).toEqual([]);
    } finally {
      await statement(`DROP TRIGGER ${trigger}`);
    }
    await clearAddedParameterMeasurements(input, database);
    expect(
      await database
        .withSchema(schema)
        .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
        .where('request_id', 1003)
        .select('parameter_label'),
    ).toEqual([{ parameter_label: 'CO2 (ppm)' }]);
  }, 30000);

  it('preserves arrivals after a committed cleanup whose acknowledgement was lost', async () => {
    const input = addedInput('S9905', 1005);
    const uncertainSource = {
      transaction: async (callback: (trx: Knex.Transaction) => Promise<void>) => {
        await database.transaction(callback);
        throw new Error('Synthetic lost source commit acknowledgement');
      },
    } as unknown as Knex;
    await expect(clearAddedParameterMeasurements(input, uncertainSource)).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEASUREMENT_CLEANUP_FAILED',
    });
    await statement(`UPDATE ${qualified('S9905_data_real')}
      SET co2_value = N'888', co2_status = N'Normal', co2_ppm_value = N'888', co2_ppm_status = N'Normal'`);
    await clearAddedParameterMeasurements(input, database);
    expect(
      await statement(`SELECT co2_value, co2_ppm_value, co2_percent_value
      FROM ${qualified('S9905_data_real')}`),
    ).toEqual([
      {
        co2_value: '888',
        co2_ppm_value: '888',
        co2_percent_value: '10.4',
      },
    ]);
  }, 30000);

  it('rejects an existing CO2 label whose unit contains only whitespace without clearing any family', async () => {
    const input = addedInput('S9906', 1006);
    input.points[0].connectedParametersJson = JSON.stringify(['CO (ppm)', 'CO2 (   )']);
    await expect(clearAddedParameterMeasurements(input, database)).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEASUREMENT_CLEANUP_FAILED',
    });
    for (const interval of CONNECTION_CLEANUP_INTERVALS) {
      expect(
        await statement(`SELECT co_value, co2_value, co2_ppm_value, co2_percent_value
        FROM ${qualified(`S9906_data_${interval}`)}`),
      ).toEqual([
        {
          co_value: '12.5',
          co2_value: '530',
          co2_ppm_value: '530',
          co2_percent_value: '10.4',
        },
      ]);
    }
    expect(
      await database
        .withSchema(schema)
        .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
        .where('request_id', 1006)
        .select('parameter_key'),
    ).toEqual([]);
  });

  it('rejects a percent alias that shares columns with an existing parameter identity', async () => {
    const input = addedInput('S9907', 1007, 'CO2 (%)');
    input.points[0].connectedParametersJson = JSON.stringify(['CO (ppm)', 'CO2 (percent)']);
    await expect(clearAddedParameterMeasurements(input, database)).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEASUREMENT_CLEANUP_FAILED',
    });
    for (const interval of CONNECTION_CLEANUP_INTERVALS) {
      expect(
        await statement(`SELECT co_value, co2_value, co2_ppm_value, co2_percent_value
        FROM ${qualified(`S9907_data_${interval}`)}`),
      ).toEqual([
        {
          co_value: '12.5',
          co2_value: '530',
          co2_ppm_value: '530',
          co2_percent_value: '10.4',
        },
      ]);
    }
    expect(
      await database
        .withSchema(schema)
        .table(PARAMETER_CLEANUP_RECEIPTS_TABLE)
        .where('request_id', 1007)
        .select('parameter_key'),
    ).toEqual([]);
  });

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
