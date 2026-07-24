import { config as loadEnv } from 'dotenv';
import knex, { type Knex } from 'knex';
import {
  buildDeletePlan,
  findParameterTables,
  quoteSqlIdentifier,
  validateProductionDatabaseTargets,
  type ForeignKeyEdge,
} from '../db/maintenance/test-data-reset-plan';

const RESET_CONFIRMATION = 'RESET-POMS-TEST-DATA';
const REQUIRED_DATABASE = 'POMS';
const REQUIRED_PARAMETER_DATABASE = 'parameter_ingest';
const CORE_ROOTS = [
  'cems_wpms_connection_requests',
  'cems_wpms_connected_measurement_points',
  'device_connection_configs',
  'alert_events',
  'measurement_daily_summaries',
] as const;
const PRESERVED_TABLES = ['users', 'factories', 'eligible_factories'] as const;

type ResetMode = 'preview' | 'execute';
type CountRow = { total: number | string };
type NameRow = { table_name: string };
type StationRow = { station_id: string | null };
type SequenceRow = { last_sequence: number | string | null };

async function main(): Promise<void> {
  const envFile = process.env.POMS_ENV_FILE;
  if (!envFile) throw new Error('POMS_ENV_FILE is required');
  loadEnv({ path: envFile });

  const mode = parseMode(process.env.RESET_MODE);
  validateEnvironment(mode);

  const pomsDb = createDatabaseConnection('');
  const parameterDb = createDatabaseConnection('PARAMETER_');

  try {
    const existingTables = new Set(await listTables(pomsDb));
    const missingRoots = CORE_ROOTS.filter((table) => !existingTables.has(table));
    if (missingRoots.length > 0) {
      throw new Error(`Required operational tables are missing: ${missingRoots.join(', ')}`);
    }

    const edges = await listForeignKeyEdges(pomsDb);
    const deletePlan = buildDeletePlan([...CORE_ROOTS], edges).filter((table) =>
      existingTables.has(table),
    );
    const stationIds = await listStationIds(pomsDb, existingTables);
    const parameterSchema = requiredEnv('PARAMETER_DB_SCHEMA');
    const parameterTables = findParameterTables(
      stationIds,
      await listTables(parameterDb, parameterSchema),
    );

    await printPreview(
      pomsDb,
      parameterDb,
      parameterSchema,
      deletePlan,
      parameterTables,
      stationIds,
    );
    if (mode === 'preview') {
      console.log('PREVIEW COMPLETE: no data was changed.');
      return;
    }

    await backupDatabase(pomsDb, REQUIRED_DATABASE);
    if (parameterTables.length > 0) {
      await backupDatabase(parameterDb, REQUIRED_PARAMETER_DATABASE);
    }

    await clearParameterRows(parameterDb, parameterSchema, parameterTables);
    await clearPomsOperationalData(pomsDb, deletePlan);
    await verifyReset(pomsDb, parameterDb, parameterSchema, parameterTables);
    console.log('RESET COMPLETE: operational test data was removed and numbering was reset.');
  } finally {
    await Promise.allSettled([pomsDb.destroy(), parameterDb.destroy()]);
  }
}

function parseMode(value: string | undefined): ResetMode {
  if (value === 'preview' || value === 'execute') return value;
  throw new Error('RESET_MODE must be preview or execute');
}

function validateEnvironment(mode: ResetMode): void {
  validateProductionDatabaseTargets({
    databaseName: requiredEnv('DB_NAME'),
    databaseHost: requiredEnv('DB_HOST'),
    parameterDatabaseName: requiredEnv('PARAMETER_DB_NAME'),
    parameterDatabaseHost: requiredEnv('PARAMETER_DB_HOST'),
  });
  if (mode === 'execute' && process.env.RESET_CONFIRMATION !== RESET_CONFIRMATION) {
    throw new Error(`RESET_CONFIRMATION must equal ${RESET_CONFIRMATION}`);
  }
}

function createDatabaseConnection(prefix: '' | 'PARAMETER_'): Knex {
  return knex({
    client: 'mssql',
    connection: {
      server: requiredEnv(`${prefix}DB_HOST`),
      port: Number(requiredEnv(`${prefix}DB_PORT`)),
      user: requiredEnv(`${prefix}DB_USER`),
      password: requiredEnv(`${prefix}DB_PASSWORD`),
      database: requiredEnv(`${prefix}DB_NAME`),
      options: {
        encrypt: process.env[`${prefix}DB_ENCRYPT`] === 'true',
        trustServerCertificate: process.env[`${prefix}DB_TRUST_SERVER_CERTIFICATE`] !== 'false',
      },
    },
    pool: { min: 0, max: 2 },
  });
}

async function listTables(db: Knex, schema = 'dbo'): Promise<string[]> {
  const rows = await db<NameRow>('sys.tables as t')
    .join('sys.schemas as s', 't.schema_id', 's.schema_id')
    .where('s.name', schema)
    .select({ table_name: 't.name' })
    .orderBy('t.name');
  return rows.map((row) => row.table_name);
}

async function listForeignKeyEdges(db: Knex): Promise<ForeignKeyEdge[]> {
  const rows = await db('sys.foreign_keys as fk')
    .join('sys.tables as child', 'fk.parent_object_id', 'child.object_id')
    .join('sys.tables as parent', 'fk.referenced_object_id', 'parent.object_id')
    .join('sys.schemas as child_schema', 'child.schema_id', 'child_schema.schema_id')
    .join('sys.schemas as parent_schema', 'parent.schema_id', 'parent_schema.schema_id')
    .where('child_schema.name', 'dbo')
    .where('parent_schema.name', 'dbo')
    .select<ForeignKeyEdge[]>({
      parentTable: 'parent.name',
      childTable: 'child.name',
    })
    .orderBy(['parent.name', 'child.name']);
  return rows;
}

async function listStationIds(db: Knex, tables: Set<string>): Promise<string[]> {
  const stationIds = new Set<string>();
  const addRows = (rows: StationRow[]): void => {
    for (const row of rows) {
      const value = row.station_id?.trim();
      if (value) stationIds.add(value);
    }
  };

  if (tables.has('cems_wpms_measurement_points')) {
    addRows(
      await db<StationRow>('cems_wpms_measurement_points')
        .whereNotNull('point_code')
        .select({ station_id: 'point_code' }),
    );
    addRows(
      await db<StationRow>('cems_wpms_measurement_points')
        .whereNotNull('point_name')
        .select({ station_id: 'point_name' }),
    );
  }
  if (tables.has('cems_wpms_connected_measurement_points')) {
    addRows(
      await db<StationRow>('cems_wpms_connected_measurement_points')
        .whereNotNull('point_code')
        .select({ station_id: 'point_code' }),
    );
    addRows(
      await db<StationRow>('cems_wpms_connected_measurement_points')
        .whereNotNull('point_name')
        .select({ station_id: 'point_name' }),
    );
  }
  for (const table of [
    'device_connection_configs',
    'alert_events',
    'measurement_daily_summaries',
  ]) {
    if (!tables.has(table)) continue;
    addRows(
      await db<StationRow>(table).whereNotNull('station_id').select({ station_id: 'station_id' }),
    );
  }

  return [...stationIds].sort();
}

async function printPreview(
  pomsDb: Knex,
  parameterDb: Knex,
  parameterSchema: string,
  deletePlan: string[],
  parameterTables: string[],
  stationIds: string[],
): Promise<void> {
  console.log(`Target database: ${REQUIRED_DATABASE}`);
  console.log(`Operational delete order (${deletePlan.length} tables):`);
  for (const table of deletePlan) {
    console.log(`  ${table}: ${await countRows(pomsDb, 'dbo', table)} rows`);
  }
  console.log('Preserved master data:');
  for (const table of PRESERVED_TABLES) {
    console.log(`  ${table}: ${await countRows(pomsDb, 'dbo', table)} rows`);
  }
  console.log(`Captured station identifiers: ${stationIds.length}`);
  for (const stationId of stationIds) console.log(`  station: ${stationId}`);
  console.log(`Parameter tables to clear (${parameterTables.length}):`);
  for (const table of parameterTables) {
    console.log(
      `  ${parameterSchema}.${table}: ${await countRows(parameterDb, parameterSchema, table)} rows`,
    );
  }
}

async function countRows(db: Knex, schema: string, table: string): Promise<number> {
  const row = await db<CountRow>(table).withSchema(schema).count<CountRow>({ total: '*' }).first();
  return Number(row?.total ?? 0);
}

async function backupDatabase(db: Knex, databaseName: string): Promise<void> {
  const safeDatabase = quoteSqlIdentifier(databaseName);
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const fileName = `${databaseName}_before_test_data_reset_${timestamp}.bak`;
  await db.raw(`
    DECLARE @base NVARCHAR(4000) = CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(4000));
    IF @base IS NULL OR LEN(@base) = 0 THROW 51000, 'SQL Server default backup path is unavailable', 1;
    IF RIGHT(@base, 1) NOT IN ('\\', '/') SET @base = @base + '\\';
    DECLARE @backupFile NVARCHAR(4000) = @base + N'${fileName}';
    BACKUP DATABASE ${safeDatabase}
      TO DISK = @backupFile
      WITH COPY_ONLY, INIT, CHECKSUM, STATS = 10;
    RESTORE VERIFYONLY FROM DISK = @backupFile WITH CHECKSUM;
  `);
  console.log(`Verified backup created for ${databaseName}: ${fileName}`);
}

async function clearParameterRows(
  db: Knex,
  schema: string,
  parameterTables: string[],
): Promise<void> {
  if (parameterTables.length === 0) return;
  await db.transaction(async (trx) => {
    for (const table of parameterTables) await trx(table).withSchema(schema).del();
  });
}

async function clearPomsOperationalData(db: Knex, deletePlan: string[]): Promise<void> {
  await db.transaction(async (trx) => {
    for (const table of deletePlan) await trx(table).withSchema('dbo').del();
    await trx('cems_wpms_annual_point_code_sequences').withSchema('dbo').del();
    await trx('cems_wpms_direct_request_sequences').withSchema('dbo').update({
      last_sequence: 0,
      updated_at: trx.fn.now(),
    });
  });
}

async function verifyReset(
  pomsDb: Knex,
  parameterDb: Knex,
  parameterSchema: string,
  parameterTables: string[],
): Promise<void> {
  for (const root of CORE_ROOTS) {
    const total = await countRows(pomsDb, 'dbo', root);
    if (total !== 0) throw new Error(`Reset verification failed: ${root} still has ${total} rows`);
  }
  const annualSequenceTotal = await countRows(
    pomsDb,
    'dbo',
    'cems_wpms_annual_point_code_sequences',
  );
  if (annualSequenceTotal !== 0) {
    throw new Error('Reset verification failed: annual point-code sequences are not empty');
  }
  const directSequence = await pomsDb<SequenceRow>('cems_wpms_direct_request_sequences')
    .max<SequenceRow>({ last_sequence: 'last_sequence' })
    .first();
  if (Number(directSequence?.last_sequence ?? 0) !== 0) {
    throw new Error('Reset verification failed: direct request sequences are not zero');
  }
  for (const table of parameterTables) {
    const total = await countRows(parameterDb, parameterSchema, table);
    if (total !== 0) {
      throw new Error(
        `Reset verification failed: ${parameterSchema}.${table} still has ${total} rows`,
      );
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
