import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import knex, { type Knex } from 'knex';

export const TEST_DATABASE = 'poms_factory_profile_test';
export const TEST_PURPOSE = 'factory-profile-integration-synthetic-only';

export function assertTestDatabaseIdentity(
  value: { databaseName?: unknown; purpose?: unknown } | undefined,
): void {
  if (value?.databaseName !== TEST_DATABASE || value?.purpose !== TEST_PURPOSE) {
    throw new Error('Dedicated synthetic test database required');
  }
}

export function buildTestDatabaseConfig(settings: NodeJS.ProcessEnv): Knex.Config {
  const host = settings.POMS_SQL_TEST_HOST;
  const user = settings.POMS_SQL_TEST_USER;
  const password = settings.POMS_SQL_TEST_PASSWORD;
  if (!host || !user || !password || settings.POMS_SQL_TEST_DATABASE !== TEST_DATABASE) {
    throw new Error('Explicit POMS_SQL_TEST settings required');
  }
  const portText = settings.POMS_SQL_TEST_PORT ?? '1433';
  if (!/^[0-9]+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('Invalid test SQL port');
  }
  for (const name of ['POMS_SQL_TEST_ENCRYPT', 'POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE']) {
    if (settings[name] !== undefined && !['true', 'false'].includes(settings[name]!)) {
      throw new Error('Invalid test SQL encryption setting');
    }
  }
  return {
    client: 'mssql',
    connection: {
      server: host,
      port: Number(portText),
      database: TEST_DATABASE,
      user,
      password,
      requestTimeout: 15_000,
      options: {
        encrypt: settings.POMS_SQL_TEST_ENCRYPT === 'true',
        trustServerCertificate: settings.POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE === 'true',
      },
    },
    pool: { min: 0, max: 3 },
    acquireConnectionTimeout: 15_000,
  };
}

async function guard(database: Knex): Promise<void> {
  const rows = await database.raw(
    'SELECT DB_NAME() AS databaseName, CONVERT(NVARCHAR(128), value) AS purpose ' +
      "FROM sys.extended_properties WHERE class = 0 AND name = N'PomsTestPurpose'",
  );
  assertTestDatabaseIdentity(rows[0]);
}

function errorNumber(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { number?: number }).number;
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { statusCode?: number }).statusCode;
}

const snapshotTables = [
  'eligible_factories',
  'cems_wpms_connected_measurement_points',
  'factory_monitoring_point_forms',
  'factory_profiles',
  'factory_profile_events',
  'poms_factory_edit_requests',
  'cems_wpms_connection_requests',
  'factories',
  'fac_import',
];

async function snapshot(database: Knex): Promise<string> {
  const values: Record<string, unknown> = {};
  for (const name of snapshotTables) values[name] = await database(name).select('*').orderBy('id');
  return JSON.stringify(values);
}

function metadata(table: Knex.CreateTableBuilder): void {
  table.bigInteger('id').primary();
  table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
  table.bigInteger('updated_by').nullable();
  table.specificType('deleted_at', 'DATETIME2 NULL');
}

function textColumns(table: Knex.CreateTableBuilder, fields: string[]): void {
  for (const name of fields) table.specificType(name, 'NVARCHAR(1000) NULL');
}

async function createSyntheticFixtures(database: Knex): Promise<void> {
  await database.transaction(async (trx) => {
    await guard(trx);
    const [{ count }] = await trx.raw(
      'SELECT COUNT(*) AS count FROM sys.tables WHERE is_ms_shipped = 0',
    );
    assert.equal(Number(count), 0, 'Verification requires an empty newly provisioned database');
    await trx.schema.createTable('users', (table) => {
      metadata(table);
    });
    await trx.schema.createTable('factory_monitoring_point_forms', (table) => {
      metadata(table);
      textColumns(table, [
        'factory_name',
        'address',
        'province_name',
        'factory_type_main',
        'factory_type_sub',
        'factory_registration_no_new',
        'factory_registration_no_old',
        'business_activity',
        'eia_info',
        'eia_other',
        'project_name',
        'operation_status',
      ]);
      table.decimal('latitude', 10, 7).nullable();
      table.decimal('longitude', 10, 7).nullable();
    });
    await trx.schema.createTable('eligible_factories', (table) => {
      metadata(table);
      textColumns(table, [
        'source_factory_id',
        'factory_registration_no_new',
        'factory_registration_no_old',
        'factory_name',
        'address',
        'province_name',
        'industrial_estate_name',
        'business_activity',
        'factory_type_sequence',
        'eia_assessment',
        'eia_other',
        'project_name',
      ]);
      table
        .bigInteger('monitoring_point_form_id')
        .nullable()
        .references('id')
        .inTable('factory_monitoring_point_forms');
      table.decimal('latitude', 10, 7).nullable();
      table.decimal('longitude', 10, 7).nullable();
      table.boolean('has_eia').nullable();
    });
    await trx.schema.createTable('cems_wpms_connected_measurement_points', (table) => {
      metadata(table);
      table.bigInteger('eligible_factory_id').references('id').inTable('eligible_factories');
      textColumns(table, [
        'factory_id',
        'factory_registration_no',
        'factory_name',
        'factory_address',
        'factory_eia_assessment',
        'factory_eia_other',
        'factory_project_name',
        'point_name',
        'operation_status',
      ]);
      table.decimal('factory_latitude', 10, 7).nullable();
      table.decimal('factory_longitude', 10, 7).nullable();
      table.boolean('factory_has_eia').nullable();
      for (const name of [
        'factory_front_photos_json',
        'factory_logo_json',
        'parameters_json',
        'details_json',
      ])
        table.specificType(name, 'NVARCHAR(MAX) NULL');
    });
    for (const name of ['poms_factory_edit_requests', 'cems_wpms_connection_requests']) {
      await trx.schema.createTable(name, (table) => {
        metadata(table);
        table.specificType('snapshot_json', 'NVARCHAR(MAX) NULL');
      });
    }
    for (const name of ['factories', 'fac_import']) {
      await trx.schema.createTable(name, (table) => {
        metadata(table);
        table.specificType('factory_name', 'NVARCHAR(500) NULL');
      });
    }
    await trx('users').insert({ id: 1 });
    const common = {
      factory_name: 'โรงงานสมมติ ก',
      address: 'ที่อยู่สมมติ ก',
      latitude: 13.1234567,
      longitude: 100.7654321,
      eia_assessment: 'ไม่มี',
      eia_other: null,
      has_eia: false,
      project_name: null,
    };
    await trx('factory_monitoring_point_forms').insert({
      id: 1000,
      factory_name: common.factory_name,
      address: common.address,
      latitude: common.latitude,
      longitude: common.longitude,
      eia_info: common.eia_assessment,
      factory_registration_no_new: 'FIXTURE-REG-A',
      factory_type_main: '00088',
      province_name: 'จังหวัดสมมติ',
      operation_status: 'fixture-form-status',
    });
    await trx('eligible_factories').insert([
      {
        id: 10,
        ...common,
        source_factory_id: 'FIXTURE-A',
        factory_registration_no_new: 'FIXTURE-REG-A',
        monitoring_point_form_id: 1000,
        province_name: 'จังหวัดสมมติ',
        factory_type_sequence: '88',
      },
      {
        id: 20,
        ...common,
        factory_name: 'โรงงานสมมติ ข',
        source_factory_id: 'FIXTURE-B',
        factory_registration_no_new: 'FIXTURE-REG-B',
        monitoring_point_form_id: null,
        province_name: 'จังหวัดสมมติ',
        factory_type_sequence: '88',
      },
    ]);
    for (const id of [100, 101, 102]) {
      await trx('cems_wpms_connected_measurement_points').insert({
        id,
        eligible_factory_id: 10,
        factory_id: 'FIXTURE-A',
        factory_registration_no: 'FIXTURE-REG-A',
        factory_name: common.factory_name,
        factory_address: common.address,
        factory_latitude: common.latitude,
        factory_longitude: common.longitude,
        factory_eia_assessment: common.eia_assessment,
        factory_has_eia: false,
        factory_front_photos_json: '[{"url":"/fictional/photo"}]',
        factory_logo_json: '{"url":"/fictional/logo"}',
        point_name: 'จุดสมมติ ' + id,
        operation_status: 'fixture-point-status',
        parameters_json: '{"fixtureParameter":1}',
        details_json: '{"fixtureDocument":true}',
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
        deleted_at: id === 102 ? new Date('2026-01-02T00:00:00.000Z') : null,
      });
    }
    for (const name of ['poms_factory_edit_requests', 'cems_wpms_connection_requests']) {
      await trx(name).insert({ id: 1, snapshot_json: '{"name":"ข้อมูลประวัติสมมติ"}' });
    }
    for (const name of ['factories', 'fac_import']) {
      await trx(name).insert({ id: 1, factory_name: 'ข้อมูลทะเบียนสมมติ ห้ามแก้' });
    }
  });
}

interface VerificationCheck {
  name: string;
  passed: true;
  durationMs: number;
}
export interface SqlVerificationReport {
  runId: string;
  databaseName: string;
  databaseId: number;
  databaseGuid: string;
  productVersion: string;
  startedAt: string;
  completedAt?: string;
  passed: boolean;
  checks: VerificationCheck[];
}

export async function runSyntheticSqlVerification(
  settings: NodeJS.ProcessEnv,
  onCheck: (check: VerificationCheck) => void = () => undefined,
): Promise<SqlVerificationReport> {
  const config = buildTestDatabaseConfig(settings);
  // Only modules accepting an explicit transaction are imported. Never load the app,
  // scheduler, production database singleton, or external API clients.
  Object.assign(process.env, {
    NODE_ENV: 'test',
    FACTORY_PROFILE_MODE: 'canonical',
    DB_HOST: settings.POMS_SQL_TEST_HOST,
    DB_PORT: settings.POMS_SQL_TEST_PORT ?? '1433',
    DB_NAME: TEST_DATABASE,
    DB_USER: settings.POMS_SQL_TEST_USER,
    DB_PASSWORD: settings.POMS_SQL_TEST_PASSWORD,
    JWT_SECRET: 'synthetic-sql-verification-key',
    JWT_REFRESH_SECRET: 'synthetic-sql-verification-refresh-key',
    PUBLIC_BASE_URL: 'http://fixture.invalid',
  });
  const profiles = await import('../src/modules/factory-profiles/factory-profiles.repository');
  const { isCanonicalFactoryProfilesEnabled } =
    await import('../src/modules/factory-profiles/factory-profile-mode');
  assert.equal(
    isCanonicalFactoryProfilesEnabled(),
    true,
    'Canonical mode must be active for these tests',
  );
  const { runFactoryProfileBackfill } =
    await import('../src/modules/factory-profiles/factory-profile-backfill');
  const schemaMigration = await import('../src/db/migrations/0114_create_factory_profiles');
  const viewsMigration =
    await import('../src/db/migrations/0115_create_current_factory_profile_views');
  const migrations = [
    { name: '0114_create_factory_profiles.ts', module: schemaMigration },
    { name: '0115_create_current_factory_profile_views.ts', module: viewsMigration },
  ];
  const migrationOptions = {
    tableName: 'knex_migrations_profile_test',
    migrationSource: {
      getMigrations: async () => migrations,
      getMigrationName: (migration: (typeof migrations)[number]) => migration.name,
      getMigration: async (migration: (typeof migrations)[number]) => migration.module,
    },
  };
  const database = knex(config);
  let stage = 'target identity';
  try {
    await guard(database);
    const [identity] = await database.raw(
      'SELECT DB_ID() AS databaseId, CONVERT(VARCHAR(36), database_guid) AS databaseGuid, ' +
        "CONVERT(VARCHAR(32), SERVERPROPERTY('ProductVersion')) AS productVersion " +
        'FROM sys.database_recovery_status WHERE database_id = DB_ID()',
    );
    const report: SqlVerificationReport = {
      runId: randomUUID(),
      databaseName: TEST_DATABASE,
      ...identity,
      startedAt: new Date().toISOString(),
      passed: false,
      checks: [],
    };
    const check = async (name: string, action: () => Promise<void>) => {
      stage = name;
      await guard(database);
      const start = Date.now();
      await action();
      const result: VerificationCheck = { name, passed: true, durationMs: Date.now() - start };
      report.checks.push(result);
      onCheck(result);
    };
    const profile = () => database('factory_profiles').where('eligible_factory_id', 10).first();
    const update = async (
      patch: Parameters<typeof profiles.updateFactoryProfileInTransaction>[2],
      source: string,
    ) => {
      const current = await profile();
      await database.transaction(async (trx) => {
        await guard(trx);
        await profiles.updateFactoryProfileInTransaction(
          trx,
          10,
          patch,
          1,
          source,
          Number(current.revision),
        );
      });
    };
    const expectSqlFailure = async (
      operation: (trx: Knex.Transaction) => Promise<unknown>,
      numbers: number[],
    ) => {
      await assert.rejects(
        database.transaction(async (trx) => {
          await guard(trx);
          await operation(trx);
        }),
        (error: unknown) => numbers.includes(errorNumber(error) ?? -1),
      );
    };
    await check('create synthetic fixture tables in empty test database', async () =>
      createSyntheticFixtures(database),
    );
    await check('Knex migrations 0114 and 0115 up', async () => {
      await database.migrate.latest(migrationOptions);
      assert.equal(await database.schema.hasTable('factory_profiles'), true);
      assert.equal(await database.schema.hasTable('current_connected_measurement_points'), true);
      assert.equal(
        await database.schema.hasColumn(
          'poms_factory_edit_requests',
          'source_factory_profile_revision',
        ),
        true,
      );
      assert.equal(
        await database.schema.hasColumn(
          'cems_wpms_connection_requests',
          'source_factory_profile_revision',
        ),
        true,
      );
      assert.equal((await database('knex_migrations_profile_test')).length, 2);
    });
    await check('views preserve legacy values before any backfill', async () => {
      const row = await database('current_eligible_factories').where('id', 10).first();
      assert.equal(row.factory_name, 'โรงงานสมมติ ก');
      assert.equal(row.factory_profile_revision, null);
    });
    await check('empty canonical schema rolls back and reapplies through Knex', async () => {
      await database.migrate.rollback(migrationOptions, true);
      assert.equal(await database.schema.hasTable('factory_profiles'), false);
      assert.equal(await database.schema.hasTable('current_eligible_factories'), false);
      assert.equal(
        await database.schema.hasColumn(
          'poms_factory_edit_requests',
          'source_factory_profile_revision',
        ),
        false,
      );
      assert.equal((await database('eligible_factories')).length, 2);
      await database.migrate.latest(migrationOptions);
    });
    const immutableBefore: Record<string, string> = {};
    for (const table of [
      'factories',
      'fac_import',
      'poms_factory_edit_requests',
      'cems_wpms_connection_requests',
    ]) {
      immutableBefore[table] = JSON.stringify(await database(table).orderBy('id'));
    }
    await check('conflicting linked form refuses apply without inserting profiles', async () => {
      await database('factory_monitoring_point_forms')
        .where('id', 1000)
        .update({ address: 'ข้อมูลสมมติขัดแย้ง' });
      await assert.rejects(
        runFactoryProfileBackfill(database, { apply: true, actorUserId: 1 }),
        (error: unknown) => statusCode(error) === 409,
      );
      assert.equal((await database('factory_profiles')).length, 0);
      await database('factory_monitoring_point_forms')
        .where('id', 1000)
        .update({ address: 'ที่อยู่สมมติ ก' });
    });
    await check('bounded backfill is idempotent and becomes ready only when complete', async () => {
      const before = await snapshot(database);
      const dry = await runFactoryProfileBackfill(database, { apply: false });
      assert.equal(dry.counts.seedableProfiles, 2);
      assert.equal(dry.insertedProfiles, 0);
      assert.equal(await snapshot(database), before);
      const first = await runFactoryProfileBackfill(database, {
        apply: true,
        actorUserId: 1,
        batchSize: 1,
      });
      assert.equal(first.insertedProfiles, 1);
      assert.equal(first.readyForCanonical, false);
      const second = await runFactoryProfileBackfill(database, {
        apply: true,
        actorUserId: 1,
        batchSize: 1,
      });
      assert.equal(second.insertedProfiles, 1);
      assert.equal(second.readyForCanonical, true);
      const complete = await snapshot(database);
      const third = await runFactoryProfileBackfill(database, { apply: true, actorUserId: 1 });
      assert.equal(third.insertedProfiles, 0);
      assert.equal(await snapshot(database), complete);
    });
    await check('SQL preserves Thai text and seven decimal coordinate places', async () => {
      const row = await profile();
      assert.equal(row.factory_name, 'โรงงานสมมติ ก');
      assert.equal(Number(row.latitude), 13.1234567);
      assert.equal(Number(row.longitude), 100.7654321);
    });
    await check('unique and foreign-key constraints reject invalid profile links', async () => {
      await expectSqlFailure(
        (trx) =>
          trx('factory_profiles').insert({ eligible_factory_id: 10, factory_name: 'Duplicate' }),
        [2601, 2627],
      );
      await expectSqlFailure(
        (trx) =>
          trx('factory_profiles').insert({
            eligible_factory_id: 999,
            factory_name: 'Missing eligible',
          }),
        [547],
      );
    });
    await check('SQL check constraints reject invalid coordinates revision and JSON', async () => {
      for (const patch of [
        { latitude: 91 },
        { longitude: 181 },
        { revision: 0 },
        { front_photos_json: '{' },
        { eia_assessment: 'invalid' },
      ]) {
        await expectSqlFailure(
          (trx) => trx('factory_profiles').where('eligible_factory_id', 10).update(patch),
          [547],
        );
      }
      for (const table of ['poms_factory_edit_requests', 'cems_wpms_connection_requests']) {
        await expectSqlFailure(
          (trx) => trx(table).where('id', 1).update({ source_factory_profile_revision: 0 }),
          [547],
        );
      }
    });
    await check(
      'audit event constraints reject duplicates invalid JSON and blank sources',
      async () => {
        const current = await profile();
        for (const entry of [
          { revision: 1 },
          { revision: 100, source: ' ' },
          { revision: 100, after_json: '{' },
        ]) {
          await expectSqlFailure(
            (trx) =>
              trx('factory_profile_events').insert({
                factory_profile_id: current.id,
                source: 'fixture',
                actor_user_id: 1,
                after_json: '{}',
                ...entry,
              }),
            [547, 2601, 2627],
          );
        }
      },
    );
    const originalPoints = await database('cems_wpms_connected_measurement_points').orderBy('id');
    await check(
      'general update projects atomically to eligible active points and linked form',
      async () => {
        await update(
          {
            factory_name: 'โรงงานสมมติ แก้ชื่อ',
            address: null,
            latitude: 13.7654321,
            longitude: 100.1234567,
            province_name: 'จังหวัดสมมติใหม่',
            project_name: 'โครงการสมมติ',
            eia_assessment: 'อื่นๆ',
            eia_other: 'รายละเอียดสมมติ',
            factory_type_sequence: '88 / 89',
          },
          'sql-test-general',
        );
        const current = await profile();
        assert.equal(Number(current.revision), 2);
        assert.equal(current.has_eia, false);
        const eligible = await database('eligible_factories').where('id', 10).first();
        const form = await database('factory_monitoring_point_forms').where('id', 1000).first();
        assert.equal(eligible.factory_name, current.factory_name);
        assert.equal(eligible.address, null);
        assert.equal(form.factory_name, current.factory_name);
        assert.equal(form.address, null);
        assert.equal(form.eia_info, 'อื่นๆ');
        assert.equal(form.factory_type_main, '00088');
        assert.equal(form.factory_type_sub, '00089');
        const points = await database('cems_wpms_connected_measurement_points').orderBy('id');
        for (let index = 0; index < 2; index++) {
          assert.equal(points[index].factory_name, current.factory_name);
          assert.equal(points[index].factory_address, null);
          assert.equal(Number(points[index].factory_latitude), 13.7654321);
          assert.equal(points[index].parameters_json, originalPoints[index].parameters_json);
          assert.equal(points[index].details_json, originalPoints[index].details_json);
          assert.equal(String(points[index].updated_at), String(originalPoints[index].updated_at));
        }
        assert.deepEqual(points[2], originalPoints[2], 'Deleted point must remain unchanged');
      },
    );
    await check(
      'canonical NULL does not fall back to stale base values in any current view',
      async () => {
        const rollback = new Error('rollback fixture-only stale values');
        const before = await snapshot(database);
        await assert.rejects(
          database.transaction(async (trx) => {
            await guard(trx);
            await trx('eligible_factories').where('id', 10).update({ address: 'stale eligible' });
            await trx('factory_monitoring_point_forms')
              .where('id', 1000)
              .update({ address: 'stale form' });
            await trx('cems_wpms_connected_measurement_points')
              .where('id', 100)
              .update({ factory_address: 'stale point' });
            for (const [table, id, column] of [
              ['current_eligible_factories', 10, 'address'],
              ['current_factory_monitoring_point_forms', 1000, 'address'],
              ['current_connected_measurement_points', 100, 'factory_address'],
            ] as const)
              assert.equal((await trx(table).where('id', id).first())[column], null);
            throw rollback;
          }),
          (error: unknown) => error === rollback,
        );
        assert.equal(await snapshot(database), before);
      },
    );
    await check('no-op general edit leaves revisions timestamps and audit unchanged', async () => {
      const before = await snapshot(database);
      await update({ factory_name: 'โรงงานสมมติ แก้ชื่อ' }, 'sql-test-noop');
      assert.equal(await snapshot(database), before);
    });
    await check('stale expected revision rejects all writes', async () => {
      const before = await snapshot(database);
      await assert.rejects(
        database.transaction(async (trx) => {
          await guard(trx);
          await profiles.updateFactoryProfileInTransaction(
            trx,
            10,
            { factory_name: 'stale writer' },
            1,
            'sql-test-stale',
            1,
          );
        }),
        (error: unknown) => statusCode(error) === 409,
      );
      assert.equal(await snapshot(database), before);
    });
    await check(
      'late audit constraint failure rolls back profile projections and audit together',
      async () => {
        const before = await snapshot(database);
        await assert.rejects(
          update({ factory_name: 'must rollback' }, ' '),
          (error: unknown) => errorNumber(error) === 547,
        );
        assert.equal(await snapshot(database), before);
      },
    );
    await check(
      'explicit exception rolls back an otherwise successful general update',
      async () => {
        const before = await snapshot(database);
        const current = await profile();
        const rollback = new Error('synthetic failure after writer completed');
        await assert.rejects(
          database.transaction(async (trx) => {
            await guard(trx);
            await profiles.updateFactoryProfileInTransaction(
              trx,
              10,
              { factory_name: 'rollback name' },
              1,
              'sql-test-rollback',
              Number(current.revision),
            );
            throw rollback;
          }),
          (error: unknown) => error === rollback,
        );
        assert.equal(await snapshot(database), before);
      },
    );
    await check(
      'point-only storage edit leaves factory profile eligible form and history unchanged',
      async () => {
        const before: Record<string, string> = {};
        for (const table of snapshotTables.filter(
          (name) => name !== 'cems_wpms_connected_measurement_points',
        )) {
          before[table] = JSON.stringify(await database(table).orderBy('id'));
        }
        await database.transaction(async (trx) => {
          await guard(trx);
          await trx('cems_wpms_connected_measurement_points').where('id', 100).update({
            point_name: 'จุดสมมติ แก้เฉพาะจุด',
            parameters_json: '{"fixtureParameter":2}',
            updated_at: trx.fn.now(),
          });
        });
        for (const [table, value] of Object.entries(before)) {
          assert.equal(JSON.stringify(await database(table).orderBy('id')), value);
        }
      },
    );
    await check(
      'two concurrent writers block correctly and only one expected revision succeeds',
      async () => {
        const current = await profile();
        const expectedRevision = Number(current.revision);
        const first = await database.transaction();
        const second = await database.transaction();
        let pending: Promise<{ succeeded: boolean; error?: unknown }> | undefined;
        let committed = false;
        try {
          await guard(first);
          await guard(second);
          const [{ spid: firstId }] = await first.raw('SELECT @@SPID AS spid');
          const [{ spid: secondId }] = await second.raw('SELECT @@SPID AS spid');
          assert.notEqual(firstId, secondId);
          await profiles.updateFactoryProfileInTransaction(
            first,
            10,
            { project_name: 'ผู้เขียนหนึ่ง' },
            1,
            'sql-test-concurrent-first',
            expectedRevision,
          );
          pending = profiles
            .updateFactoryProfileInTransaction(
              second,
              10,
              { project_name: 'ผู้เขียนสอง' },
              1,
              'sql-test-concurrent-second',
              expectedRevision,
            )
            .then(
              () => ({ succeeded: true }),
              (error: unknown) => ({ succeeded: false, error }),
            );
          let observedBlocking = false;
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            const requests = await database.raw(
              'SELECT blocking_session_id AS blockedBy FROM sys.dm_exec_requests WHERE session_id = ?',
              [secondId],
            );
            if (
              requests.some(
                (row: { blockedBy: number }) => Number(row.blockedBy) === Number(firstId),
              )
            ) {
              observedBlocking = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          assert.equal(
            observedBlocking,
            true,
            'Must observe a real SQL lock wait before releasing the first writer',
          );
          await first.commit();
          committed = true;
          const result = await pending;
          assert.equal(result.succeeded, false);
          assert.equal(statusCode(result.error), 409);
          await second.rollback();
        } finally {
          if (!committed && !first.isCompleted()) await first.rollback();
          if (pending) await pending;
          if (!second.isCompleted()) await second.rollback();
        }
        const after = await profile();
        assert.equal(Number(after.revision), expectedRevision + 1);
        assert.equal(after.project_name, 'ผู้เขียนหนึ่ง');
        assert.equal(
          (await database('factory_profile_events').where('source', 'sql-test-concurrent-first'))
            .length,
          1,
        );
        assert.equal(
          (await database('factory_profile_events').where('source', 'sql-test-concurrent-second'))
            .length,
          0,
        );
      },
    );
    await check(
      'populated canonical migrations refuse destructive down without losing data',
      async () => {
        const before = await snapshot(database);
        await assert.rejects(
          database.migrate.rollback(migrationOptions, true),
          (error: unknown) => errorNumber(error) === 51142,
        );
        await expectSqlFailure((trx) => schemaMigration.down(trx), [51140]);
        assert.equal(await snapshot(database), before);
        assert.equal((await database('knex_migrations_profile_test')).length, 2);
      },
    );
    await check(
      'final readiness succeeds and historical registry fixtures remain unchanged',
      async () => {
        const finalAudit = await runFactoryProfileBackfill(database, { apply: false });
        assert.equal(finalAudit.readyForCanonical, true);
        assert.equal(finalAudit.counts.conflicts, 0);
        for (const [table, value] of Object.entries(immutableBefore)) {
          assert.equal(JSON.stringify(await database(table).orderBy('id')), value);
        }
      },
    );
    stage = 'record successful verification for guarded cleanup';
    await database.raw("EXEC sys.sp_addextendedproperty @name=N'PomsTestPassedRun', @value=?", [
      report.runId,
    ]);
    report.passed = true;
    report.completedAt = new Date().toISOString();
    return report;
  } catch (error) {
    throw Object.assign(new Error('SQL verification failed at: ' + stage), {
      stage,
      sqlNumber: errorNumber(error),
      cause: error,
    });
  } finally {
    await database.destroy();
  }
}

if (require.main === module) {
  if (process.argv.slice(2).join(' ') !== '--run-synthetic-tests') {
    process.stdout.write(
      'Usage: tsx scripts/factory-profile-sql-verification.ts --run-synthetic-tests\n' +
        'Requires explicit POMS_SQL_TEST_* settings and an empty provisioned test database.\n' +
        'Creates synthetic fixture tables and runs only migrations 0114/0115; never starts the app.\n',
    );
    process.exitCode = process.argv.includes('--help') ? 0 : 1;
  } else {
    void runSyntheticSqlVerification(process.env, (check) => {
      process.stderr.write('PASS ' + check.name + '\n');
    })
      .then((report) => {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      })
      .catch((error: { stage?: string; sqlNumber?: number }) => {
        process.stderr.write(
          JSON.stringify({ passed: false, stage: error.stage, sqlNumber: error.sqlNumber }) + '\n',
        );
        process.exitCode = 1;
      });
  }
}
