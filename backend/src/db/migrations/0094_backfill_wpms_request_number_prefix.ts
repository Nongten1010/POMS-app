import type { Knex } from 'knex';

const REQUESTS_TABLE = 'cems_wpms_connection_requests';
const BACKFILL_TABLE = 'wpms_request_no_prefix_backfill_0094';
const PREFIX_GUARD_CONSTRAINT = 'ck_wpms_request_no_prefix_0094';

export const config = { transaction: true } as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(BACKFILL_TABLE, (table) => {
    table.specificType('request_id', 'BIGINT NOT NULL');
    table.specificType('original_request_no', 'VARCHAR(32) NOT NULL');
    table.specificType('normalized_request_no', 'VARCHAR(32) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.primary(['request_id'], {
      constraintName: 'pk_wpms_request_no_prefix_backfill_0094',
    });
  });

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${REQUESTS_TABLE} AS request_row WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN ${REQUESTS_TABLE} AS existing_request WITH (UPDLOCK, HOLDLOCK)
        ON existing_request.request_no = STUFF(request_row.request_no, 1, 5, 'WPMS-')
      WHERE ${legacyWpmsAnnualRequestFilter('request_row')}
    )
    BEGIN
      THROW 51094, N'WPMS_REQUEST_NO_PREFIX_COLLISION', 1;
    END;

    UPDATE request_row
    SET request_row.request_no = STUFF(request_row.request_no, 1, 5, 'WPMS-')
    OUTPUT INSERTED.id, DELETED.request_no, INSERTED.request_no
    INTO ${BACKFILL_TABLE} (request_id, original_request_no, normalized_request_no)
    FROM ${REQUESTS_TABLE} AS request_row
    WHERE ${legacyWpmsAnnualRequestFilter('request_row')};

    ALTER TABLE ${REQUESTS_TABLE} WITH CHECK
    ADD CONSTRAINT ${PREFIX_GUARD_CONSTRAINT}
    CHECK (NOT (
      ${legacyWpmsAnnualRequestFilter()}
    ));
  `);
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(BACKFILL_TABLE))) return;

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = N'${PREFIX_GUARD_CONSTRAINT}'
        AND parent_object_id = OBJECT_ID(N'${REQUESTS_TABLE}')
    )
    BEGIN
      ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${PREFIX_GUARD_CONSTRAINT};
    END;

    IF EXISTS (
      SELECT 1
      FROM ${BACKFILL_TABLE} AS backup
      LEFT JOIN ${REQUESTS_TABLE} AS request_row
        ON request_row.id = backup.request_id
      WHERE request_row.id IS NULL
        OR request_row.request_no <> backup.normalized_request_no
        OR request_row.system_type <> 'WPMS'
    )
    BEGIN
      THROW 51094, N'WPMS_REQUEST_NO_ROLLBACK_STATE_CHANGED', 1;
    END;

    IF EXISTS (
      SELECT 1
      FROM ${BACKFILL_TABLE} AS backup
      INNER JOIN ${REQUESTS_TABLE} AS occupied_request WITH (UPDLOCK, HOLDLOCK)
        ON occupied_request.request_no = backup.original_request_no
       AND occupied_request.id <> backup.request_id
    )
    BEGIN
      THROW 51094, N'WPMS_REQUEST_NO_ROLLBACK_COLLISION', 1;
    END;

    UPDATE request_row
    SET request_row.request_no = backup.original_request_no
    FROM ${REQUESTS_TABLE} AS request_row
    INNER JOIN ${BACKFILL_TABLE} AS backup
      ON backup.request_id = request_row.id
    WHERE request_row.request_no = backup.normalized_request_no
      AND request_row.system_type = 'WPMS';
  `);

  await knex.schema.dropTable(BACKFILL_TABLE);
}

function legacyWpmsAnnualRequestFilter(alias?: string): string {
  const systemTypeColumn = qualifyColumn(alias, 'system_type');
  const requestNoColumn = qualifyColumn(alias, 'request_no');

  return `${systemTypeColumn} = 'WPMS'
        AND LEFT(${requestNoColumn}, 5) = 'WEMS-'
        AND CHARINDEX('/', ${requestNoColumn}) >= 10
        AND CHARINDEX('/', ${requestNoColumn}) = DATALENGTH(${requestNoColumn}) - 4
        AND SUBSTRING(
          ${requestNoColumn},
          6,
          CASE
            WHEN CHARINDEX('/', ${requestNoColumn}) > 6
              THEN CHARINDEX('/', ${requestNoColumn}) - 6
            ELSE 0
          END
        ) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%'
        AND RIGHT(${requestNoColumn}, 4)
          COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%'`;
}

function qualifyColumn(alias: string | undefined, column: string): string {
  return alias ? `${alias}.${column}` : column;
}
