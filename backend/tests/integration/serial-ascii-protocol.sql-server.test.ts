import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { down, up } from '../../src/db/migrations/0147_allow_serial_ascii_device_protocol';

// Never load application DB_* or .env credentials for this suite.
const enabled = process.env.POMS_DEVICE_CONFIG_SQL_TEST_ENABLED;
if (enabled !== undefined && !['true', 'false'].includes(enabled)) {
  throw new Error('POMS_DEVICE_CONFIG_SQL_TEST_ENABLED must be true or false');
}
const sqlDescribe = enabled === 'true' ? describe : describe.skip;

sqlDescribe('Serial ASCII migration on an isolated SQL Server', () => {
  let database: Knex;
  let tableCreated = false;
  const table = 'device_connection_configs';
  const legacyProtocols = ['POMS_BOX', 'MODBUS_RTU', 'DCON_ASCII', 'MODBUS_TCP', 'MSSQL', 'MYSQL'];

  beforeAll(async () => {
    const settings = process.env;
    if (
      settings.POMS_DEVICE_CONFIG_SQL_TEST_DATABASE !== 'poms_device_config_test' ||
      !settings.POMS_DEVICE_CONFIG_SQL_TEST_HOST ||
      !settings.POMS_DEVICE_CONFIG_SQL_TEST_USER ||
      !settings.POMS_DEVICE_CONFIG_SQL_TEST_PASSWORD
    ) {
      throw new Error(
        'Dedicated POMS_DEVICE_CONFIG_SQL_TEST_* credentials for poms_device_config_test are required',
      );
    }
    const port = Number(settings.POMS_DEVICE_CONFIG_SQL_TEST_PORT ?? 1433);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid SQL test port');
    database = knex({
      client: 'mssql',
      connection: {
        server: settings.POMS_DEVICE_CONFIG_SQL_TEST_HOST,
        database: 'poms_device_config_test',
        user: settings.POMS_DEVICE_CONFIG_SQL_TEST_USER,
        password: settings.POMS_DEVICE_CONFIG_SQL_TEST_PASSWORD,
        port,
        options: { encrypt: true, trustServerCertificate: false },
      },
      pool: { min: 0, max: 1 },
    });
    const [identity] = await database.raw(`
      SELECT DB_NAME() AS database_name,
        (SELECT CONVERT(nvarchar(200), value) FROM sys.extended_properties
         WHERE class = 0 AND name = N'PomsTestPurpose') AS purpose
    `);
    if (
      identity.database_name !== 'poms_device_config_test' ||
      identity.purpose !== 'device-config-synthetic-only'
    ) {
      throw new Error('Dedicated synthetic device-config test database required');
    }
    if (await database.schema.hasTable(table))
      throw new Error('Device-config SQL fixture requires an empty test database');
    await database.schema.createTable(table, (builder) => {
      builder.increments('id');
      builder.string('protocol', 32).notNullable();
      builder.dateTime('deleted_at').nullable();
    });
    tableCreated = true;
    await database.schema.raw(`
      ALTER TABLE device_connection_configs ADD CONSTRAINT ck_device_connection_configs_protocol
      CHECK (protocol IN ('POMS_BOX', 'MODBUS_RTU', 'DCON_ASCII', 'MODBUS_TCP', 'MSSQL', 'MYSQL'));
    `);
  }, 30000);

  beforeEach(async () => {
    await database(table).delete();
    await database.transaction(down);
  });

  afterAll(async () => {
    try {
      if (tableCreated) await database.schema.dropTable(table);
    } finally {
      if (database) await database.destroy();
    }
  }, 30000);

  it('permits Serial ASCII after up, preserves legacy protocols, and rejects unknown values', async () => {
    await expect(database(table).insert({ protocol: 'SERIAL_ASCII' })).rejects.toThrow();
    await database.transaction(up);
    await database(table).insert(
      [...legacyProtocols, 'SERIAL_ASCII'].map((protocol) => ({ protocol })),
    );
    await expect(database(table).insert({ protocol: 'UNKNOWN_PROTOCOL' })).rejects.toThrow();
    expect(
      (await database(table).select('protocol').orderBy('id')).map((row) => row.protocol),
    ).toEqual([...legacyProtocols, 'SERIAL_ASCII']);
  });

  it.each([null, '2026-10-28'])(
    'refuses down with a Serial ASCII row (deleted_at=%s) and retains its data',
    async (deletedAt) => {
      await database.transaction(up);
      await database(table).insert({ protocol: 'SERIAL_ASCII', deleted_at: deletedAt });
      await expect(database.transaction(down)).rejects.toThrow(
        'Cannot remove SERIAL_ASCII protocol',
      );
      expect(await database(table).select('protocol')).toEqual([{ protocol: 'SERIAL_ASCII' }]);
      await database(table).insert({ protocol: 'SERIAL_ASCII' });
    },
  );

  it('restores the previous constraint when no Serial ASCII rows exist', async () => {
    await database.transaction(up);
    await database(table).insert(legacyProtocols.map((protocol) => ({ protocol })));
    await database.transaction(down);
    await expect(database(table).insert({ protocol: 'SERIAL_ASCII' })).rejects.toThrow();
    expect(
      (await database(table).select('protocol').orderBy('id')).map((row) => row.protocol),
    ).toEqual(legacyProtocols);
  });
});
