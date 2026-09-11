import type { Knex } from 'knex';

const PROFILES = 'factory_profiles';
const EVENTS = 'factory_profile_events';
const REQUESTS = 'poms_factory_edit_requests';
const CONNECTION_REQUESTS = 'cems_wpms_connection_requests';

export const config = { transaction: true };

// Additive schema only. Choosing and backfilling current values is a separate,
// guarded operation so migration deployment cannot overwrite reviewed data.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(PROFILES, (table) => {
    table.bigIncrements('id').primary();
    table
      .bigInteger('eligible_factory_id')
      .notNullable()
      .references('id')
      .inTable('eligible_factories');
    table.unique(['eligible_factory_id'], 'uq_factory_profiles_eligible_factory');
    table.specificType('factory_name', 'NVARCHAR(500) NOT NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('province_name', 'NVARCHAR(128) NULL');
    table.specificType('industrial_estate_name', 'NVARCHAR(255) NULL');
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
    table.specificType('eia_assessment', 'NVARCHAR(32) NULL');
    table.specificType('eia_other', 'NVARCHAR(500) NULL');
    table.boolean('has_eia').nullable();
    table.specificType('project_name', 'NVARCHAR(500) NULL');
    table.specificType('business_activity', 'NVARCHAR(MAX) NULL');
    table.specificType('factory_type_sequence', 'NVARCHAR(128) NULL');
    table.specificType('front_photos_json', 'NVARCHAR(MAX) NULL');
    table.specificType('logo_json', 'NVARCHAR(MAX) NULL');
    table.bigInteger('revision').notNullable().defaultTo(1);
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.bigInteger('created_by').nullable().references('id').inTable('users');
    table.bigInteger('updated_by').nullable().references('id').inTable('users');
  });

  await knex.schema.createTable(EVENTS, (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('factory_profile_id').notNullable().references('id').inTable(PROFILES);
    table.bigInteger('revision').notNullable();
    table.specificType('source', 'NVARCHAR(128) NOT NULL');
    table.bigInteger('actor_user_id').nullable().references('id').inTable('users');
    table.specificType('before_json', 'NVARCHAR(MAX) NULL');
    table.specificType('after_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['factory_profile_id', 'revision'], 'uq_factory_profile_events_revision');
  });

  await knex.schema.alterTable(REQUESTS, (table) => {
    table.bigInteger('source_factory_profile_revision').nullable();
  });
  await knex.schema.alterTable(CONNECTION_REQUESTS, (table) => {
    table.bigInteger('source_factory_profile_revision').nullable();
  });

  await knex.schema.raw(`
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_revision CHECK (revision > 0);
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_latitude
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_longitude
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_eia_assessment
      CHECK (eia_assessment IS NULL OR eia_assessment IN (N'มี', N'ไม่มี', N'มี IEE', N'มี EIA', N'มี EHIA', N'อื่นๆ'));
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_front_photos_json
      CHECK (front_photos_json IS NULL OR ISJSON(front_photos_json) = 1);
    ALTER TABLE ${PROFILES} ADD CONSTRAINT ck_factory_profiles_logo_json
      CHECK (logo_json IS NULL OR ISJSON(logo_json) = 1);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_factory_profile_events_revision CHECK (revision > 0);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_factory_profile_events_source
      CHECK (LEN(LTRIM(RTRIM(source))) > 0);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_factory_profile_events_before_json
      CHECK (before_json IS NULL OR ISJSON(before_json) = 1);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_factory_profile_events_after_json CHECK (ISJSON(after_json) = 1);
    ALTER TABLE ${REQUESTS} ADD CONSTRAINT ck_poms_factory_edit_request_profile_revision
      CHECK (source_factory_profile_revision IS NULL OR source_factory_profile_revision > 0);
    ALTER TABLE ${CONNECTION_REQUESTS} ADD CONSTRAINT ck_connection_request_profile_revision
      CHECK (source_factory_profile_revision IS NULL OR source_factory_profile_revision > 0);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // After adoption, preserve canonical state and use a forward migration for any
  // rollback. Dropping an empty deployment remains useful in isolated testing.
  await knex.schema.raw(`
    IF EXISTS (SELECT 1 FROM factory_profiles) OR EXISTS (SELECT 1 FROM factory_profile_events)
    BEGIN
      THROW 51140, N'Factory profiles contain data; use a forward migration to preserve canonical history.', 1;
    END;
    ALTER TABLE ${REQUESTS} DROP CONSTRAINT ck_poms_factory_edit_request_profile_revision;
    ALTER TABLE ${CONNECTION_REQUESTS} DROP CONSTRAINT ck_connection_request_profile_revision;
  `);
  await knex.schema.alterTable(REQUESTS, (table) => {
    table.dropColumn('source_factory_profile_revision');
  });
  await knex.schema.alterTable(CONNECTION_REQUESTS, (table) => {
    table.dropColumn('source_factory_profile_revision');
  });
  await knex.schema.dropTable(EVENTS);
  await knex.schema.dropTable(PROFILES);
}
