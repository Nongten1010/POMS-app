import type { Knex } from 'knex';

const REQUESTS_TABLE = 'poms_factory_edit_requests';
const EVENTS_TABLE = 'poms_factory_edit_request_events';
const REQUESTS_BACKUP_TABLE = 'poms_factory_edit_requests_backup_20260907';
const EVENTS_BACKUP_TABLE = 'poms_factory_edit_request_events_backup_20260907';
const CONNECTION_REQUESTS_TABLE = 'cems_wpms_connection_requests';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const expectedDatabase = process.env.DB_NAME?.trim();
  if (!expectedDatabase) {
    throw new Error('DB_NAME is required for the production master-data request cleanup');
  }

  // Keep target rows stable until commit; refuse triggers with unreviewed side effects.
  await knex.raw(`
    IF EXISTS (
      SELECT 1 FROM sys.triggers
      WHERE parent_id IN (OBJECT_ID(N'dbo.${REQUESTS_TABLE}'), OBJECT_ID(N'dbo.${EVENTS_TABLE}'))
        AND is_disabled = 0
    )
    BEGIN
      THROW 51004, 'Review enabled master-data table triggers before cleanup', 1;
    END;
    SELECT COUNT_BIG(*) FROM dbo.${REQUESTS_TABLE} WITH (TABLOCKX, HOLDLOCK);
    SELECT COUNT_BIG(*) FROM dbo.${EVENTS_TABLE} WITH (TABLOCKX, HOLDLOCK);
    SELECT COUNT_BIG(*) FROM dbo.${CONNECTION_REQUESTS_TABLE} WITH (TABLOCK, HOLDLOCK);
  `);

  const [requestCountBefore, eventCountBefore, connectionRequestCountBefore] = await Promise.all([
    countRows(knex, REQUESTS_TABLE),
    countRows(knex, EVENTS_TABLE),
    countRows(knex, CONNECTION_REQUESTS_TABLE),
  ]);

  await knex.raw(
    `
      IF DB_NAME() <> ?
      BEGIN
        THROW 51000, 'Connected database does not match DB_NAME', 1;
      END;

      IF OBJECT_ID(N'dbo.${REQUESTS_BACKUP_TABLE}', N'U') IS NOT NULL
         OR OBJECT_ID(N'dbo.${EVENTS_BACKUP_TABLE}', N'U') IS NOT NULL
      BEGIN
        THROW 51001, 'Master-data request cleanup backup tables already exist', 1;
      END;

      SELECT *
      INTO dbo.${REQUESTS_BACKUP_TABLE}
      FROM dbo.${REQUESTS_TABLE};

      SELECT *
      INTO dbo.${EVENTS_BACKUP_TABLE}
      FROM dbo.${EVENTS_TABLE};

      IF (SELECT COUNT_BIG(*) FROM dbo.${REQUESTS_BACKUP_TABLE}) <> ?
         OR (SELECT COUNT_BIG(*) FROM dbo.${EVENTS_BACKUP_TABLE}) <> ?
      BEGIN
        THROW 51002, 'Master-data request backup row count mismatch', 1;
      END;

      DELETE FROM dbo.${EVENTS_TABLE};
      DELETE FROM dbo.${REQUESTS_TABLE};
    `,
    [expectedDatabase, requestCountBefore, eventCountBefore],
  );

  const [requestCountAfter, eventCountAfter, connectionRequestCountAfter] = await Promise.all([
    countRows(knex, REQUESTS_TABLE),
    countRows(knex, EVENTS_TABLE),
    countRows(knex, CONNECTION_REQUESTS_TABLE),
  ]);

  if (requestCountAfter !== 0 || eventCountAfter !== 0) {
    throw new Error('Production master-data request cleanup did not empty both target tables');
  }

  if (connectionRequestCountAfter !== connectionRequestCountBefore) {
    throw new Error('Connection-request guard failed; rolling the cleanup transaction back');
  }

  console.log(
    `[migration 0110] cleared ${requestCountBefore} POMS factory edit requests and ${eventCountBefore} events; ` +
      `preserved ${connectionRequestCountAfter} CEMS/WPMS connection requests`,
  );
}

export async function down(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const [requestCount, eventCount] = await Promise.all([
    countRows(knex, REQUESTS_TABLE),
    countRows(knex, EVENTS_TABLE),
  ]);

  if (requestCount !== 0 || eventCount !== 0) {
    throw new Error(
      'Cannot restore the cleanup backup after new master-data requests were created',
    );
  }

  await knex.raw(`
    IF OBJECT_ID(N'dbo.${REQUESTS_BACKUP_TABLE}', N'U') IS NULL
       OR OBJECT_ID(N'dbo.${EVENTS_BACKUP_TABLE}', N'U') IS NULL
    BEGIN
      THROW 51003, 'Master-data request cleanup backup tables are missing', 1;
    END;

    SET IDENTITY_INSERT dbo.${REQUESTS_TABLE} ON;

    INSERT INTO dbo.${REQUESTS_TABLE} (
      id,
      request_no,
      eligible_factory_id,
      factory_id,
      factory_registration_no,
      factory_name,
      status,
      revision_no,
      is_open,
      current_factory_json,
      proposed_factory_json,
      source_profile_updated_at,
      request_note,
      revision_reason,
      officer_note,
      submitted_by,
      reviewed_by,
      submitted_at,
      reviewed_at,
      approved_at,
      created_at,
      updated_at,
      created_by,
      updated_by,
      deleted_at,
      form_type,
      current_measurement_points_json,
      proposed_measurement_points_json
    )
    SELECT
      id,
      request_no,
      eligible_factory_id,
      factory_id,
      factory_registration_no,
      factory_name,
      status,
      revision_no,
      is_open,
      current_factory_json,
      proposed_factory_json,
      source_profile_updated_at,
      request_note,
      revision_reason,
      officer_note,
      submitted_by,
      reviewed_by,
      submitted_at,
      reviewed_at,
      approved_at,
      created_at,
      updated_at,
      created_by,
      updated_by,
      deleted_at,
      form_type,
      current_measurement_points_json,
      proposed_measurement_points_json
    FROM dbo.${REQUESTS_BACKUP_TABLE};

    SET IDENTITY_INSERT dbo.${REQUESTS_TABLE} OFF;
    SET IDENTITY_INSERT dbo.${EVENTS_TABLE} ON;

    INSERT INTO dbo.${EVENTS_TABLE} (
      id,
      request_id,
      action,
      from_status,
      to_status,
      event_note,
      factory_snapshot_json,
      actor_user_id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      deleted_at
    )
    SELECT
      id,
      request_id,
      action,
      from_status,
      to_status,
      event_note,
      factory_snapshot_json,
      actor_user_id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      deleted_at
    FROM dbo.${EVENTS_BACKUP_TABLE};

    SET IDENTITY_INSERT dbo.${EVENTS_TABLE} OFF;

    DROP TABLE dbo.${EVENTS_BACKUP_TABLE};
    DROP TABLE dbo.${REQUESTS_BACKUP_TABLE};
  `);
}

async function countRows(knex: Knex, tableName: string): Promise<number> {
  const row = await knex(tableName).count<{ count: string | number }[]>({ count: '*' }).first();
  return Number(row?.count ?? 0);
}
