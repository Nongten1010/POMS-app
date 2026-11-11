import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { env } from '../../src/config/env';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';

const sqlTests = process.env.RUN_POMS_MINUTE_SQL_TEST === '1' ? describe : describe.skip;

sqlTests('minute reader on isolated SQL Server', () => {
  let database: Knex | undefined;
  let restoreRunner: (() => void) | undefined;
  let created = false;
  const originalSchema = env.PARAMETER_DB_SCHEMA;
  const schema = `minute_fixture_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    const settings = process.env;
    if (
      settings.POMS_MINUTE_SQL_TEST_DATABASE !== 'poms_measurement_minutes_test' ||
      !settings.POMS_MINUTE_SQL_TEST_HOST ||
      !settings.POMS_MINUTE_SQL_TEST_USER ||
      !settings.POMS_MINUTE_SQL_TEST_PASSWORD
    ) {
      throw new Error(
        'Explicit POMS_MINUTE_SQL_TEST credentials for poms_measurement_minutes_test are required',
      );
    }
    const port = Number(settings.POMS_MINUTE_SQL_TEST_PORT ?? 1433);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid SQL test port');
    database = knex({
      client: 'mssql',
      connection: {
        server: settings.POMS_MINUTE_SQL_TEST_HOST,
        port,
        database: settings.POMS_MINUTE_SQL_TEST_DATABASE,
        user: settings.POMS_MINUTE_SQL_TEST_USER,
        password: settings.POMS_MINUTE_SQL_TEST_PASSWORD,
        options: { encrypt: true, trustServerCertificate: true },
      },
      pool: { min: 0, max: 2 },
    });
    const [identity] = await database.raw('SELECT DB_NAME() AS name');
    if (identity.name !== 'poms_measurement_minutes_test')
      throw new Error('Unexpected SQL test database');
    await database.raw(`CREATE SCHEMA [${schema}]`);
    created = true;
    await database.schema.withSchema(schema).createTable('S0199_data_1m', (table) => {
      table.date('cdate');
      table.specificType('ctime', 'time(7)');
      table.decimal('co_value', 28, 10);
    });
    for (const hour of ['00', '09', '23']) {
      await database
        .withSchema(schema)
        .table('S0199_data_1m')
        .insert([
          { cdate: '2026-11-11', ctime: `${hour}:00:00`, co_value: 1.25 },
          { cdate: '2026-11-11', ctime: `${hour}:59:59.9999999`, co_value: 2.5 },
          { cdate: '2026-11-12', ctime: `${hour}:00:00`, co_value: 99 },
        ]);
    }
    const connection = database;
    const runner = jest
      .spyOn(parameterSourceDb.client, 'runner')
      .mockImplementation((builder: unknown) => connection.client.runner(builder));
    restoreRunner = () => runner.mockRestore();
    env.PARAMETER_DB_SCHEMA = schema;
  }, 30000);

  afterAll(async () => {
    restoreRunner?.();
    env.PARAMETER_DB_SCHEMA = originalSchema;
    try {
      if (created && database) {
        await database.schema.withSchema(schema).dropTableIfExists('S0199_data_1m');
        await database.raw(`DROP SCHEMA [${schema}]`);
      }
    } finally {
      await database?.destroy();
    }
  });

  it.each(['00', '09', '23'])(
    'reads only hour %s with real date/time columns and bindings',
    async (hour) => {
      const rows = await parameterValuesRepository.listMinuteRows({
        stationId: 'S0199',
        date: '2026-11-11',
        hour,
      });
      expect(rows.map((row) => row.co_value)).toEqual([1.25, 2.5]);
      expect(rows[1].ctime).toBe(`${hour}:59:59.9999999`);
    },
  );
});
