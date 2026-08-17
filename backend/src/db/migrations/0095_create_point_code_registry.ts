import type { Knex } from 'knex';

const REGISTRY_TABLE = 'cems_wpms_point_code_registry';
const POINTS_TABLE = 'cems_wpms_measurement_points';
const REGISTRY_UNIQUE_INDEX = 'uq_cems_wpms_point_code_registry_normalized';
const REGISTRY_IMMUTABLE_TRIGGER = 'trg_cems_wpms_point_code_registry_immutable';
const POINT_ASSIGNMENT_MODE_CHECK = 'ck_cems_wpms_points_point_code_assignment_mode';

const ASSIGNMENT_MODES = ['AUTO', 'MANUAL_LEGACY', 'OFFICER_DIRECT', 'LEGACY_IMPORTED'] as const;

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(REGISTRY_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('point_code', 'VARCHAR(64) NOT NULL');
    table.specificType('normalized_point_code', 'VARCHAR(64) NOT NULL');
    table.specificType('system_type', 'VARCHAR(8) NOT NULL');
    table.specificType('prefix', 'CHAR(1) NULL');
    table.integer('numeric_sequence').nullable();
    table.specificType('assignment_mode', 'VARCHAR(32) NOT NULL');
    table.bigInteger('source_request_id').nullable();
    table.bigInteger('source_measurement_point_id').nullable();
    table.specificType('reason', 'NVARCHAR(1000) NULL');
    table.bigInteger('assigned_by').nullable();
    table.specificType(
      'assigned_at',
      'DATETIME2 NOT NULL CONSTRAINT df_cems_wpms_point_code_registry_assigned_at DEFAULT SYSDATETIME()',
    );
    table.specificType(
      'created_at',
      'DATETIME2 NOT NULL CONSTRAINT df_cems_wpms_point_code_registry_created_at DEFAULT SYSDATETIME()',
    );

    table.unique(['normalized_point_code'], { indexName: REGISTRY_UNIQUE_INDEX });
    table
      .foreign('source_request_id', 'fk_point_code_registry_source_request')
      .references('id')
      .inTable('cems_wpms_connection_requests');
    table
      .foreign('source_measurement_point_id', 'fk_point_code_registry_source_measurement_point')
      .references('id')
      .inTable(POINTS_TABLE);
  });

  await knex.schema.alterTable(POINTS_TABLE, (table) => {
    table.specificType('point_code_assignment_mode', 'VARCHAR(32) NULL');
    table.specificType('point_code_assignment_reason', 'NVARCHAR(1000) NULL');
    table.bigInteger('point_code_assigned_by').nullable();
    table.specificType('point_code_assigned_at', 'DATETIME2 NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE ${REGISTRY_TABLE}
    ADD CONSTRAINT ck_cems_wpms_point_code_registry_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));

    ALTER TABLE ${REGISTRY_TABLE}
    ADD CONSTRAINT ck_cems_wpms_point_code_registry_prefix_sequence
    CHECK (
      (prefix IS NULL AND numeric_sequence IS NULL)
      OR (
        prefix IS NOT NULL
        AND numeric_sequence IS NOT NULL
        AND prefix IN ('S', 'W')
        AND numeric_sequence BETWEEN 0 AND 9999
        AND normalized_point_code =
          prefix + RIGHT('0000' + CONVERT(VARCHAR(4), numeric_sequence), 4)
      )
    );

    ALTER TABLE ${REGISTRY_TABLE}
    ADD CONSTRAINT ck_cems_wpms_point_code_registry_assignment_mode
    CHECK (assignment_mode IN (${ASSIGNMENT_MODES.map((mode) => `'${mode}'`).join(', ')}));

    ALTER TABLE ${REGISTRY_TABLE}
    ADD CONSTRAINT ck_cems_wpms_point_code_registry_normalized
    CHECK (
      normalized_point_code = UPPER(LTRIM(RTRIM(point_code)))
      AND normalized_point_code <> ''
    );

    ALTER TABLE ${POINTS_TABLE}
    ADD CONSTRAINT ${POINT_ASSIGNMENT_MODE_CHECK}
    CHECK (
      point_code_assignment_mode IS NULL
      OR point_code_assignment_mode IN (${ASSIGNMENT_MODES.map((mode) => `'${mode}'`).join(', ')})
    );
  `);

  await backfillExistingPointCodes(knex);

  await knex.schema.raw(`
    CREATE TRIGGER ${REGISTRY_IMMUTABLE_TRIGGER}
    ON ${REGISTRY_TABLE}
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51095, 'Point-code registry rows are immutable and cannot be updated or deleted.', 1;
    END;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF OBJECT_ID('${REGISTRY_IMMUTABLE_TRIGGER}', 'TR') IS NOT NULL
    BEGIN
      DROP TRIGGER ${REGISTRY_IMMUTABLE_TRIGGER};
    END;
  `);

  await knex.schema.dropTableIfExists(REGISTRY_TABLE);

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${POINT_ASSIGNMENT_MODE_CHECK}'
        AND parent_object_id = OBJECT_ID('${POINTS_TABLE}')
    )
    BEGIN
      ALTER TABLE ${POINTS_TABLE} DROP CONSTRAINT ${POINT_ASSIGNMENT_MODE_CHECK};
    END;
  `);

  await knex.schema.alterTable(POINTS_TABLE, (table) => {
    table.dropColumn('point_code_assignment_mode');
    table.dropColumn('point_code_assignment_reason');
    table.dropColumn('point_code_assigned_by');
    table.dropColumn('point_code_assigned_at');
  });
}

async function backfillExistingPointCodes(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ;WITH measurement_point_candidates AS (
      SELECT
        LTRIM(RTRIM(mp.point_code)) AS point_code,
        UPPER(LTRIM(RTRIM(mp.point_code))) AS normalized_point_code,
        request_row.system_type,
        mp.request_id AS source_request_id,
        mp.id AS source_measurement_point_id,
        COALESCE(mp.updated_by, mp.created_by, request_row.updated_by, request_row.created_by) AS assigned_by,
        COALESCE(mp.updated_at, mp.created_at, request_row.updated_at, request_row.created_at) AS assigned_at,
        1 AS source_priority
      FROM cems_wpms_measurement_points AS mp
      INNER JOIN cems_wpms_connection_requests AS request_row
        ON request_row.id = mp.request_id
      WHERE NULLIF(LTRIM(RTRIM(mp.point_code)), '') IS NOT NULL
        AND ISNULL(request_row.request_type, 'NEW_CONNECTION') <> 'ADD_PARAMETER'
    ),
    connected_point_candidates AS (
      SELECT
        LTRIM(RTRIM(connected.point_code)) AS point_code,
        UPPER(LTRIM(RTRIM(connected.point_code))) AS normalized_point_code,
        connected.system_type,
        connected.source_request_id,
        connected.source_measurement_point_id,
        COALESCE(connected.updated_by, connected.created_by) AS assigned_by,
        COALESCE(connected.connected_at, connected.updated_at, connected.created_at) AS assigned_at,
        2 AS source_priority
      FROM cems_wpms_connected_measurement_points AS connected
      INNER JOIN cems_wpms_connection_requests AS request_row
        ON request_row.id = connected.source_request_id
      WHERE NULLIF(LTRIM(RTRIM(connected.point_code)), '') IS NOT NULL
        AND ISNULL(request_row.request_type, 'NEW_CONNECTION') <> 'ADD_PARAMETER'
    ),
    all_candidates AS (
      SELECT * FROM measurement_point_candidates
      UNION ALL
      SELECT * FROM connected_point_candidates
    ),
    ranked_candidates AS (
      SELECT
        candidate.*,
        ROW_NUMBER() OVER (
          PARTITION BY candidate.normalized_point_code
          ORDER BY
            candidate.source_priority ASC,
            candidate.assigned_at ASC,
            candidate.source_request_id ASC,
            candidate.source_measurement_point_id ASC,
            candidate.point_code ASC
        ) AS ownership_rank
      FROM all_candidates AS candidate
    )
    INSERT INTO ${REGISTRY_TABLE} (
      point_code,
      normalized_point_code,
      system_type,
      prefix,
      numeric_sequence,
      assignment_mode,
      source_request_id,
      source_measurement_point_id,
      reason,
      assigned_by,
      assigned_at
    )
    SELECT
      ranked.point_code,
      ranked.normalized_point_code,
      ranked.system_type,
      CASE
        WHEN LEN(ranked.normalized_point_code) = 5
          AND LEFT(ranked.normalized_point_code, 1) IN ('S', 'W')
          AND SUBSTRING(ranked.normalized_point_code, 2, 4) NOT LIKE '%[^0-9]%'
        THEN LEFT(ranked.normalized_point_code, 1)
        ELSE NULL
      END AS prefix,
      CASE
        WHEN LEN(ranked.normalized_point_code) = 5
          AND LEFT(ranked.normalized_point_code, 1) IN ('S', 'W')
          AND SUBSTRING(ranked.normalized_point_code, 2, 4) NOT LIKE '%[^0-9]%'
        THEN TRY_CONVERT(INT, SUBSTRING(ranked.normalized_point_code, 2, 4))
        ELSE NULL
      END AS numeric_sequence,
      'LEGACY_IMPORTED' AS assignment_mode,
      ranked.source_request_id,
      ranked.source_measurement_point_id,
      CAST(NULL AS NVARCHAR(1000)) AS reason,
      ranked.assigned_by,
      ranked.assigned_at
    FROM ranked_candidates AS ranked
    WHERE ranked.ownership_rank = 1;

    UPDATE mp
    SET
      mp.point_code_assignment_mode = 'LEGACY_IMPORTED',
      mp.point_code_assignment_reason = NULL,
      mp.point_code_assigned_by = COALESCE(
        mp.updated_by,
        mp.created_by,
        request_row.updated_by,
        request_row.created_by
      ),
      mp.point_code_assigned_at = COALESCE(
        mp.updated_at,
        mp.created_at,
        request_row.updated_at,
        request_row.created_at
      )
    FROM cems_wpms_measurement_points AS mp
    INNER JOIN cems_wpms_connection_requests AS request_row
      ON request_row.id = mp.request_id
    WHERE NULLIF(LTRIM(RTRIM(mp.point_code)), '') IS NOT NULL
      AND ISNULL(request_row.request_type, 'NEW_CONNECTION') <> 'ADD_PARAMETER';
  `);
}
