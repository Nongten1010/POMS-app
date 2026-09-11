import { afterAll, describe, expect, it } from '@jest/globals';
import knex, { type Knex } from 'knex';

type Migration = {
  up: (db: Knex) => Promise<void>;
  down: (db: Knex) => Promise<void>;
  config: { transaction: boolean };
};

const client = knex({ client: 'mssql' });
afterAll(async () => client.destroy());

async function loadMigration(name: string): Promise<Migration> {
  return import(`../../src/db/migrations/${name}`) as Promise<Migration>;
}

function captureMigration() {
  const statements: string[] = [];
  const db = {
    schema: {
      createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
        statements.push(
          ...client.schema
            .createTable(name, callback)
            .toSQL()
            .map((sql) => sql.sql),
        );
      },
      alterTable: async (name: string, callback: (table: Knex.AlterTableBuilder) => void) => {
        statements.push(
          ...client.schema
            .alterTable(name, callback)
            .toSQL()
            .map((sql) => sql.sql),
        );
      },
      raw: async (sql: string) => {
        statements.push(sql);
      },
      dropTable: async (name: string) => {
        statements.push(`DROP TABLE ${name}`);
      },
    },
  } as unknown as Knex;
  return { db, statements };
}

describe('canonical factory profile schema migrations', () => {
  it('adds one independent profile per eligible factory without changing existing records or IDs', async () => {
    const migration = await loadMigration('0114_create_factory_profiles');
    const { db, statements } = captureMigration();
    await migration.up(db);
    const sql = statements.join('\n');
    expect(migration.config.transaction).toBe(true);
    expect(sql).toContain('CREATE TABLE [factory_profiles]');
    expect(sql).toContain('[id] bigint identity(1,1)');
    expect(sql).toContain('[eligible_factory_id] bigint not null');
    expect(sql).toContain('REFERENCES [eligible_factories] ([id])');
    expect(sql).toContain('uq_factory_profiles_eligible_factory');
    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT INTO|DELETE FROM)\s/iu);
    expect(sql).not.toMatch(/ON DELETE CASCADE|REFERENCES \[factories\]/iu);
  });

  it('stores the full general profile, nullable explicit clears and an independent revision', async () => {
    const migration = await loadMigration('0114_create_factory_profiles');
    const { db, statements } = captureMigration();
    await migration.up(db);
    const sql = statements.join('\n');
    expect(sql).toContain('[factory_name] NVARCHAR(500) NOT NULL');
    for (const column of [
      'address',
      'province_name',
      'industrial_estate_name',
      'eia_assessment',
      'eia_other',
      'project_name',
      'business_activity',
      'factory_type_sequence',
      'front_photos_json',
      'logo_json',
    ]) {
      expect(sql).toMatch(new RegExp(`\\[${column}\\] NVARCHAR\\((?:\\d+|MAX)\\) NULL`, 'u'));
    }
    expect(sql).toContain('[latitude] decimal(10, 7) null');
    expect(sql).toContain('[longitude] decimal(10, 7) null');
    expect(sql).toContain('[has_eia] bit null');
    expect(sql).toMatch(
      /\[revision\] bigint not null CONSTRAINT \[factory_profiles_revision_default\] DEFAULT '1'/u,
    );
    expect(sql).toContain('CHECK (revision > 0)');
    expect(sql).toContain('SYSUTCDATETIME()');
    expect(sql).toContain(
      'ALTER TABLE [poms_factory_edit_requests] ADD [source_factory_profile_revision] bigint null',
    );
    expect(sql).toContain(
      'ALTER TABLE [cems_wpms_connection_requests] ADD [source_factory_profile_revision] bigint null',
    );
  });

  it('enforces JSON, coordinate and audit integrity without requiring a synthetic actor', async () => {
    const migration = await loadMigration('0114_create_factory_profiles');
    const { db, statements } = captureMigration();
    await migration.up(db);
    const sql = statements.join('\n');
    expect(sql).toContain('CREATE TABLE [factory_profile_events]');
    expect(sql).toContain('REFERENCES [factory_profiles] ([id])');
    expect(sql).toContain('uq_factory_profile_events_revision');
    expect(sql).toContain('[actor_user_id] bigint null');
    expect(sql).toContain('REFERENCES [users] ([id])');
    expect(sql).toContain('ISJSON(front_photos_json) = 1');
    expect(sql).toContain('ISJSON(logo_json) = 1');
    expect(sql).toContain('before_json IS NULL OR ISJSON(before_json) = 1');
    expect(sql).toContain('ISJSON(after_json) = 1');
    expect(sql).toContain('latitude BETWEEN -90 AND 90');
    expect(sql).toContain('longitude BETWEEN -180 AND 180');
    expect(sql).toContain('LEN(LTRIM(RTRIM(source))) > 0');
  });

  it('refuses to remove populated canonical data on rollback and otherwise drops events first', async () => {
    const migration = await loadMigration('0114_create_factory_profiles');
    const { db, statements } = captureMigration();
    await migration.down(db);
    expect(statements[0]).toContain('EXISTS (SELECT 1 FROM factory_profiles)');
    expect(statements[0]).toContain('EXISTS (SELECT 1 FROM factory_profile_events)');
    expect(statements[0]).toMatch(/THROW\s+\d+/u);
    expect(statements.slice(-2)).toEqual([
      'DROP TABLE factory_profile_events',
      'DROP TABLE factory_profiles',
    ]);
  });
});

describe('canonical current factory read views', () => {
  it('creates three additive views with explicit ordered and quoted base columns', async () => {
    const migration = await loadMigration('0115_create_current_factory_profile_views');
    const { db, statements } = captureMigration();
    await migration.up(db);
    expect(migration.config.transaction).toBe(true);
    expect(statements).toHaveLength(3);
    for (const sql of statements) {
      expect(sql).toContain('FROM sys.columns');
      expect(sql).toContain('ORDER BY column_id');
      expect(sql).toContain('QUOTENAME(name)');
      expect(sql).toContain('sp_executesql');
      expect(sql).not.toMatch(/SELECT\s+(?:\w+\.)?\*/iu);
      expect(sql).not.toMatch(/UPDATE\s|INSERT INTO\s|DELETE FROM\s/iu);
    }
    expect(statements[0]).toContain('[current_eligible_factories]');
    expect(statements[1]).toContain('[current_connected_measurement_points]');
    expect(statements[2]).toContain('[current_factory_monitoring_point_forms]');
    for (const sql of statements.slice(0, 2)) {
      expect(sql).toContain('fp.[revision] AS [factory_profile_revision]');
      expect(sql).toContain('fp.[updated_at] AS [factory_profile_updated_at]');
    }
  });

  it('lets canonical NULL clear stale values and preserves base data only when no profile exists', async () => {
    const migration = await loadMigration('0115_create_current_factory_profile_views');
    const { db, statements } = captureMigration();
    await migration.up(db);
    for (const sql of statements) {
      expect(sql).toContain(
        'CASE WHEN fp.[id] IS NOT NULL THEN fp.[factory_name] ELSE base.[factory_name] END AS [factory_name]',
      );
      expect(sql).not.toContain('COALESCE');
    }
    expect(statements[1]).toContain(
      'CASE WHEN fp.[id] IS NOT NULL THEN fp.[address] ELSE base.[factory_address] END AS [factory_address]',
    );
    expect(statements[1]).toContain('fp.[front_photos_json]');
    expect(statements[1]).toContain('fp.[logo_json]');
  });

  it('joins through existing eligible IDs and preserves unlinked drafts without changing domain data', async () => {
    const migration = await loadMigration('0115_create_current_factory_profile_views');
    const { db, statements } = captureMigration();
    await migration.up(db);
    expect(statements[0]).toContain('fp.[eligible_factory_id] = base.[id]');
    expect(statements[1]).toContain('fp.[eligible_factory_id] = base.[eligible_factory_id]');
    expect(statements[2]).toContain('LEFT JOIN [dbo].[eligible_factories] AS ef');
    expect(statements[2]).toContain(
      'ef.[monitoring_point_form_id] = base.[id] AND ef.[deleted_at] IS NULL',
    );
    expect(statements[2]).toContain('fp.[eligible_factory_id] = ef.[id]');
    for (const column of [
      'id',
      'factory_id',
      'factory_registration_no',
      'parameters_json',
      'details_json',
      'updated_at',
      'deleted_at',
      'operation_status',
      'eia_info',
    ]) {
      expect(statements.join('\n')).not.toContain(`WHEN N'${column}' THEN`);
    }
  });

  it('drops only the additive views on rollback', async () => {
    const migration = await loadMigration('0115_create_current_factory_profile_views');
    const { db, statements } = captureMigration();
    await migration.down(db);
    const sql = statements.join('\n');
    expect(sql).toContain('EXISTS (SELECT 1 FROM factory_profiles)');
    expect(sql).toContain('EXISTS (SELECT 1 FROM factory_profile_events)');
    expect(sql.indexOf('THROW')).toBeLessThan(sql.indexOf('DROP VIEW'));
    for (const view of [
      'current_eligible_factories',
      'current_connected_measurement_points',
      'current_factory_monitoring_point_forms',
    ]) {
      expect(sql).toContain(`DROP VIEW [dbo].[${view}]`);
    }
    expect(sql).not.toMatch(/DROP TABLE|UPDATE\s|DELETE FROM\s/iu);
  });
});
