import type { Knex } from 'knex';
import { addAuditColumns, addTimestamps } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cems_wpms_connection_requests', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('request_no', 'VARCHAR(32) NOT NULL');
    table.specificType('factory_id', 'VARCHAR(64) NOT NULL');
    table.string('factory_name', 500).notNullable();
    table.specificType('factory_registration_no', 'NVARCHAR(64) NOT NULL');
    table.specificType('system_type', 'VARCHAR(8) NOT NULL');
    table.specificType('status', 'VARCHAR(64) NOT NULL');
    table.specificType('contact_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('contact_phone', 'VARCHAR(64) NOT NULL');
    table.specificType('contact_email', 'VARCHAR(255) NULL');
    table.specificType('remarks', 'NVARCHAR(1000) NULL');
    table.specificType('revision_reason', 'NVARCHAR(1000) NULL');
    table.specificType('officer_note', 'NVARCHAR(1000) NULL');
    table.specificType('connection_due_at', 'DATETIME2 NULL');
    table.specificType('confirmed_at', 'DATETIME2 NULL');
    table.specificType('verified_at', 'DATETIME2 NULL');
    addAuditColumns(table);
    table.unique(['request_no'], { indexName: 'uq_cems_wpms_connection_request_no' });
  });

  await knex.schema.createTable('cems_wpms_measurement_points', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('request_id').notNullable();
    table.specificType('point_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('point_type', 'VARCHAR(32) NOT NULL');
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
    table.specificType('parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('description', 'NVARCHAR(1000) NULL');
    addAuditColumns(table);
    table
      .foreign('request_id', 'fk_cems_wpms_measurement_point_request')
      .references('id')
      .inTable('cems_wpms_connection_requests');
  });

  await knex.schema.createTable('cems_wpms_request_status_history', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('request_id').notNullable();
    table.specificType('status', 'VARCHAR(64) NOT NULL');
    table.specificType('note', 'NVARCHAR(1000) NULL');
    table.bigInteger('changed_by').notNullable();
    addTimestamps(table);
    table.specificType('changed_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('request_id', 'fk_cems_wpms_status_history_request')
      .references('id')
      .inTable('cems_wpms_connection_requests');
    table
      .foreign('changed_by', 'fk_cems_wpms_status_history_user')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_cems_wpms_requests_status
    ON cems_wpms_connection_requests(status, created_at DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_cems_wpms_requests_factory
    ON cems_wpms_connection_requests(factory_id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_cems_wpms_points_request
    ON cems_wpms_measurement_points(request_id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ck_cems_wpms_requests_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ck_cems_wpms_requests_status
    CHECK (status IN (
      'PENDING_DESIGN_REVIEW',
      'WAITING_CONNECTION',
      'WAITING_FACTORY_REVISION',
      'REVISED_PENDING_DESIGN_REVIEW',
      'CONNECTION_CONFIRMED',
      'CONNECTED'
    ));
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_measurement_points
    ADD CONSTRAINT ck_cems_wpms_points_type
    CHECK (point_type IN ('STACK', 'WASTEWATER', 'OTHER'));
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_measurement_points
    ADD CONSTRAINT ck_cems_wpms_points_latitude
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_measurement_points
    ADD CONSTRAINT ck_cems_wpms_points_longitude
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cems_wpms_request_status_history');
  await knex.schema.dropTableIfExists('cems_wpms_measurement_points');
  await knex.schema.dropTableIfExists('cems_wpms_connection_requests');
}
