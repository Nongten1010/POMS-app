import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const REQUESTS_TABLE = 'poms_factory_edit_requests';
const EVENTS_TABLE = 'poms_factory_edit_request_events';

const STATUS_VALUES = [
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'REVISED_PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;

const OPEN_STATUS_VALUES = [
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'REVISED_PENDING_REVIEW',
] as const;

const TERMINAL_STATUS_VALUES = ['APPROVED', 'REJECTED'] as const;

const ACTION_VALUES = ['SUBMIT', 'RESUBMIT', 'APPROVE', 'REQUEST_REVISION', 'REJECT'] as const;

function sqlStringValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(REQUESTS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('request_no', 'VARCHAR(40) NOT NULL');
    table.bigInteger('eligible_factory_id').notNullable();
    table.specificType('factory_id', 'VARCHAR(64) NOT NULL');
    table.specificType('factory_registration_no', 'NVARCHAR(80) NOT NULL');
    table.specificType('factory_name', 'NVARCHAR(500) NOT NULL');
    table.specificType(
      'status',
      "VARCHAR(32) NOT NULL CONSTRAINT df_poms_factory_edit_requests_status DEFAULT 'PENDING_REVIEW'",
    );
    table.specificType(
      'revision_no',
      'INT NOT NULL CONSTRAINT df_poms_factory_edit_requests_revision_no DEFAULT 0',
    );
    table.specificType(
      'is_open',
      'BIT NOT NULL CONSTRAINT df_poms_factory_edit_requests_is_open DEFAULT 1',
    );
    table.specificType('current_factory_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('proposed_factory_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('source_profile_updated_at', 'DATETIME2 NOT NULL');
    table.specificType('request_note', 'NVARCHAR(1000) NULL');
    table.specificType('revision_reason', 'NVARCHAR(1000) NULL');
    table.specificType('officer_note', 'NVARCHAR(1000) NULL');
    table.bigInteger('submitted_by').notNullable();
    table.bigInteger('reviewed_by').nullable();
    table.specificType(
      'submitted_at',
      'DATETIME2 NOT NULL CONSTRAINT df_poms_factory_edit_requests_submitted_at DEFAULT SYSDATETIME()',
    );
    table.specificType('reviewed_at', 'DATETIME2 NULL');
    table.specificType('approved_at', 'DATETIME2 NULL');
    addAuditColumns(table);

    table
      .foreign('eligible_factory_id', 'fk_poms_factory_edit_requests_eligible_factory')
      .references('id')
      .inTable('eligible_factories');
    table
      .foreign('submitted_by', 'fk_poms_factory_edit_requests_submitted_by')
      .references('id')
      .inTable('users');
    table
      .foreign('reviewed_by', 'fk_poms_factory_edit_requests_reviewed_by')
      .references('id')
      .inTable('users');
    table
      .foreign('created_by', 'fk_poms_factory_edit_requests_created_by')
      .references('id')
      .inTable('users');
    table
      .foreign('updated_by', 'fk_poms_factory_edit_requests_updated_by')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_request_no
    CHECK (LEN(LTRIM(RTRIM(request_no))) > 0);

    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_status
    CHECK (status IN (${sqlStringValues(STATUS_VALUES)}));

    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_revision_no
    CHECK (revision_no >= 0);

    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_state
    CHECK (
      (status IN (${sqlStringValues(OPEN_STATUS_VALUES)}) AND is_open = 1)
      OR (status IN (${sqlStringValues(TERMINAL_STATUS_VALUES)}) AND is_open = 0)
    );

    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_current_factory_json
    CHECK (
      ISJSON(current_factory_json) = 1
      AND LEFT(LTRIM(current_factory_json), 1) = N'{'
    );

    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_requests_proposed_factory_json
    CHECK (
      ISJSON(proposed_factory_json) = 1
      AND LEFT(LTRIM(proposed_factory_json), 1) = N'{'
    );
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_poms_factory_edit_requests_request_no
    ON ${REQUESTS_TABLE}(request_no);
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_poms_factory_edit_requests_open_factory
    ON ${REQUESTS_TABLE}(eligible_factory_id)
    WHERE deleted_at IS NULL AND is_open = 1;
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_poms_factory_edit_requests_status_created
    ON ${REQUESTS_TABLE}(status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_poms_factory_edit_requests_factory_created
    ON ${REQUESTS_TABLE}(eligible_factory_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_poms_factory_edit_requests_factory_id_created
    ON ${REQUESTS_TABLE}(factory_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.createTable(EVENTS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('request_id').notNullable();
    table.specificType('action', 'VARCHAR(32) NOT NULL');
    table.specificType('from_status', 'VARCHAR(32) NULL');
    table.specificType('to_status', 'VARCHAR(32) NOT NULL');
    table.specificType('event_note', 'NVARCHAR(1000) NULL');
    table.specificType('factory_snapshot_json', 'NVARCHAR(MAX) NULL');
    table.bigInteger('actor_user_id').notNullable();
    addAuditColumns(table);

    table
      .foreign('request_id', 'fk_poms_factory_edit_request_events_request')
      .references('id')
      .inTable(REQUESTS_TABLE);
    table
      .foreign('actor_user_id', 'fk_poms_factory_edit_request_events_actor')
      .references('id')
      .inTable('users');
    table
      .foreign('created_by', 'fk_poms_factory_edit_request_events_created_by')
      .references('id')
      .inTable('users');
    table
      .foreign('updated_by', 'fk_poms_factory_edit_request_events_updated_by')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    ALTER TABLE ${EVENTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_request_events_action
    CHECK (action IN (${sqlStringValues(ACTION_VALUES)}));

    ALTER TABLE ${EVENTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_request_events_from_status
    CHECK (from_status IS NULL OR from_status IN (${sqlStringValues(STATUS_VALUES)}));

    ALTER TABLE ${EVENTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_request_events_to_status
    CHECK (to_status IN (${sqlStringValues(STATUS_VALUES)}));

    ALTER TABLE ${EVENTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_request_events_factory_snapshot_json
    CHECK (
      factory_snapshot_json IS NULL
      OR (
        ISJSON(factory_snapshot_json) = 1
        AND LEFT(LTRIM(factory_snapshot_json), 1) = N'{'
      )
    );

    ALTER TABLE ${EVENTS_TABLE}
    ADD CONSTRAINT ck_poms_factory_edit_request_events_transition
    CHECK (
      (action = 'SUBMIT' AND from_status IS NULL AND to_status = 'PENDING_REVIEW')
      OR (
        action = 'RESUBMIT'
        AND from_status = 'REVISION_REQUESTED'
        AND to_status = 'REVISED_PENDING_REVIEW'
      )
      OR (
        action = 'REQUEST_REVISION'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'REVISION_REQUESTED'
      )
      OR (
        action = 'APPROVE'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'APPROVED'
      )
      OR (
        action = 'REJECT'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'REJECTED'
      )
    );
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_poms_factory_edit_request_events_request_created
    ON ${EVENTS_TABLE}(request_id, created_at, id)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(EVENTS_TABLE);
  await knex.schema.dropTableIfExists(REQUESTS_TABLE);
}
