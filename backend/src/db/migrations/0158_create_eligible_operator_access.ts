import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('eligible_factory_source_status', (t) => {
    t.bigInteger('eligible_factory_id').primary().references('id').inTable('eligible_factories');
    t.string('flag', 16).nullable();
    t.specificType('verified_fid', 'NVARCHAR(64) NULL');
    t.specificType('last_attempt_at', 'DATETIME2 NULL');
    t.specificType('last_success_at', 'DATETIME2 NULL');
    t.string('error_code', 64).nullable();
    t.string('daily_success_key', 10).nullable();
  });
  await knex.schema.createTable('user_eligible_factory_access', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('eligible_factory_id')
      .notNullable()
      .references('id')
      .inTable('eligible_factories');
    t.bigInteger('user_id').notNullable().references('id').inTable('users');
    t.string('status', 16).notNullable();
    t.specificType('factory_fid', 'NVARCHAR(64) NOT NULL');
    t.bigInteger('granted_by').notNullable().references('id').inTable('users');
    t.specificType('granted_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    t.specificType('reason', 'NVARCHAR(1000) NULL');
    t.bigInteger('revoked_by').nullable().references('id').inTable('users');
    t.specificType('ended_at', 'DATETIME2 NULL');
    t.index(['user_id', 'status'], 'ix_eligible_access_user_status');
  });
  await knex.schema.createTable('eligible_operator_access_events', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('grant_id').notNullable().references('id').inTable('user_eligible_factory_access');
    t.string('action', 16).notNullable();
    t.bigInteger('actor_user_id').nullable().references('id').inTable('users');
    t.specificType('reason', 'NVARCHAR(1000) NULL');
    t.specificType('occurred_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    t.index(['grant_id', 'id'], 'ix_eligible_access_events_grant');
  });
  await knex.schema.createTable('eligible_factory_status_events', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('eligible_factory_id')
      .notNullable()
      .references('id')
      .inTable('eligible_factories');
    t.string('before_flag', 16).nullable();
    t.string('after_flag', 16).notNullable();
    t.specificType('observed_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
  });
  await knex.schema.createTable('eligible_factory_status_runs', (t) => {
    t.string('run_key', 10).primary();
    t.string('status', 16).notNullable();
    t.string('run_token', 36).notNullable();
    t.specificType('lease_until', 'DATETIME2 NOT NULL');
    t.specificType('finished_at', 'DATETIME2 NULL');
    t.integer('checked_count').notNullable().defaultTo(0);
    t.integer('failed_count').notNullable().defaultTo(0);
  });
  await knex.raw(`
    CREATE UNIQUE INDEX uq_eligible_access_open ON user_eligible_factory_access(eligible_factory_id, user_id) WHERE ended_at IS NULL;
    ALTER TABLE user_eligible_factory_access ADD CONSTRAINT ck_eligible_access_status CHECK (
      (status IN ('active','suspended') AND ended_at IS NULL) OR
      (status IN ('revoked','expired') AND ended_at IS NOT NULL));
    ALTER TABLE eligible_operator_access_events ADD CONSTRAINT ck_eligible_access_action CHECK (action IN ('granted','revoked','expired','suspended'));
  `);
  // Read-only projection of real eligible identities when i-industry has not supplied
  // a supporting master. No fabricated FID, juristic identity, or persisted master.
  await knex.raw(`CREATE VIEW factory_access_identities AS
    SELECT id, fid, code, name, juristic_id, province_id, industrial_estate_id,
      system_id, system_detail, verify_status, authorize_start, authorize_end,
      juristic_start, verify_date, is_active, created_at, updated_at, created_by, updated_by, deleted_at
    FROM factories
    UNION ALL
    SELECT NULL, ef.factory_registration_no_new,
      COALESCE(ef.factory_registration_no_old, ef.factory_registration_no_new), ef.factory_name,
      NULL, p.id, ie.id, NULL, NULL, 0, NULL, NULL, NULL, NULL, CAST(1 AS BIT),
      ef.created_at, ef.updated_at, ef.created_by, ef.updated_by, ef.deleted_at
    FROM eligible_factories ef
    OUTER APPLY (SELECT TOP (1) id FROM provinces WHERE name_th = ef.province_name ORDER BY id) p
    OUTER APPLY (SELECT TOP (1) id FROM industrial_estates WHERE name_th = ef.industrial_estate_name ORDER BY id) ie
    WHERE ef.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM user_eligible_factory_access g WHERE g.eligible_factory_id = ef.id AND g.ended_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM factories f WHERE f.deleted_at IS NULL AND
        (f.fid = ef.factory_registration_no_new OR f.fid = ef.source_factory_id OR
         f.code = ef.factory_registration_no_new OR f.code = ef.source_factory_id))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF EXISTS (SELECT 1 FROM user_eligible_factory_access) OR EXISTS (SELECT 1 FROM eligible_factory_status_events)
    THROW 51580, 'Access history exists; use a forward migration.', 1;`);
  await knex.raw('DROP VIEW factory_access_identities');
  for (const table of [
    'eligible_factory_status_runs',
    'eligible_factory_status_events',
    'eligible_operator_access_events',
    'user_eligible_factory_access',
    'eligible_factory_source_status',
  ]) {
    await knex.schema.dropTable(table);
  }
}
