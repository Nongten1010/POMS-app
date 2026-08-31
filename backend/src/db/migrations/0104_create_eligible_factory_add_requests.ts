import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const TABLE_NAME = 'eligible_factory_add_requests';
const STATUS_VALUES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const;

function sqlStringValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('factory_master_id').notNullable();
    table.specificType('source_factory_id', 'VARCHAR(64) NULL');
    table.specificType('factory_registration_no', 'NVARCHAR(80) NOT NULL');
    table.specificType('factory_registration_no_old', 'NVARCHAR(80) NULL');
    table.specificType('factory_name', 'NVARCHAR(500) NOT NULL');
    table.specificType('factory_type_sequence', 'NVARCHAR(128) NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('province_name', 'NVARCHAR(128) NOT NULL');
    table.specificType('industrial_estate_name', 'NVARCHAR(255) NULL');
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
    table.specificType('business_activity', 'NVARCHAR(MAX) NULL');
    table.specificType('operation_status', 'NVARCHAR(64) NOT NULL');
    table.decimal('capital_amount', 18, 2).nullable();
    table.decimal('machinery_horsepower', 18, 2).nullable();
    table.specificType('production_capacity', 'NVARCHAR(500) NULL');
    table.specificType('wastewater_discharge_info', 'NVARCHAR(MAX) NULL');
    table.integer('boiler_count').nullable();
    table.specificType('boiler_size_each', 'NVARCHAR(500) NULL');
    table.specificType('fuel_used', 'NVARCHAR(500) NULL');
    table.specificType('eia_assessment', 'NVARCHAR(32) NULL');
    table.specificType('eia_other', 'NVARCHAR(500) NULL');
    table.boolean('has_eia').nullable();
    table.specificType('project_name', 'NVARCHAR(500) NULL');
    table.specificType('factory_snapshot_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('reason', 'NVARCHAR(1000) NOT NULL');
    table.specificType(
      'status',
      "VARCHAR(32) NOT NULL CONSTRAINT df_eligible_factory_add_requests_status DEFAULT 'PENDING_REVIEW'",
    );
    table.specificType(
      'is_open',
      'BIT NOT NULL CONSTRAINT df_eligible_factory_add_requests_is_open DEFAULT 1',
    );
    table.bigInteger('eligible_factory_id').nullable();
    table.bigInteger('submitted_by').notNullable();
    table.specificType(
      'submitted_at',
      'DATETIME2 NOT NULL CONSTRAINT df_eligible_factory_add_requests_submitted_at DEFAULT SYSDATETIME()',
    );
    table.bigInteger('reviewed_by').nullable();
    table.specificType('reviewed_at', 'DATETIME2 NULL');
    table.specificType('officer_note', 'NVARCHAR(1000) NULL');
    addAuditColumns(table);

    table
      .foreign('factory_master_id', 'fk_eligible_factory_add_requests_factory_master')
      .references('id')
      .inTable('factories');
    table
      .foreign('eligible_factory_id', 'fk_eligible_factory_add_requests_eligible_factory')
      .references('id')
      .inTable('eligible_factories');
    table
      .foreign('submitted_by', 'fk_eligible_factory_add_requests_submitted_by')
      .references('id')
      .inTable('users');
    table
      .foreign('reviewed_by', 'fk_eligible_factory_add_requests_reviewed_by')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_status
    CHECK (status IN (${sqlStringValues(STATUS_VALUES)}));

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_reason
    CHECK (LEN(LTRIM(RTRIM(reason))) > 0);

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_snapshot_json
    CHECK (
      ISJSON(factory_snapshot_json) = 1
      AND LEFT(LTRIM(factory_snapshot_json), 1) = N'{'
    );

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_coordinates
    CHECK (
      (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))
      AND (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
    );

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_boiler_count
    CHECK (boiler_count IS NULL OR boiler_count >= 0);

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_review_state
    CHECK (
      (
        status = 'PENDING_REVIEW'
        AND is_open = 1
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND officer_note IS NULL
        AND eligible_factory_id IS NULL
      )
      OR (
        status = 'APPROVED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND eligible_factory_id IS NOT NULL
      )
      OR (
        status = 'REJECTED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND officer_note IS NOT NULL
        AND LEN(LTRIM(RTRIM(officer_note))) > 0
        AND eligible_factory_id IS NULL
      )
    );

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_eligible_factory_add_requests_no_self_review
    CHECK (reviewed_by IS NULL OR reviewed_by <> submitted_by);
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_eligible_factory_add_requests_open_factory
    ON ${TABLE_NAME}(factory_master_id)
    WHERE deleted_at IS NULL AND is_open = 1;
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_eligible_factory_add_requests_status_submitted
    ON ${TABLE_NAME}(status, submitted_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_eligible_factory_add_requests_submitter_submitted
    ON ${TABLE_NAME}(submitted_by, submitted_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
