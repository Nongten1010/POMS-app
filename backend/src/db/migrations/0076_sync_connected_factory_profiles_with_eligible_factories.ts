import type { Knex } from 'knex';

const CONNECTED_POINTS_TABLE = 'cems_wpms_connected_measurement_points';
const REQUESTS_TABLE = 'cems_wpms_connection_requests';
const ELIGIBLE_FACTORIES_TABLE = 'eligible_factories';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    ADD eligible_factory_id BIGINT NULL;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD
      eligible_factory_id BIGINT NULL,
      factory_eia_assessment NVARCHAR(32) NULL,
      factory_eia_other NVARCHAR(500) NULL,
      factory_has_eia BIT NULL,
      factory_project_name NVARCHAR(500) NULL,
      factory_front_photos_json NVARCHAR(MAX) NULL,
      factory_logo_json NVARCHAR(MAX) NULL;

    ALTER TABLE ${ELIGIBLE_FACTORIES_TABLE}
    ADD
      eia_assessment NVARCHAR(32) NULL,
      eia_other NVARCHAR(500) NULL,
      project_name NVARCHAR(500) NULL;

    UPDATE ${ELIGIBLE_FACTORIES_TABLE}
    SET eia_assessment = CASE
      WHEN has_eia = 1 THEN N'มี'
      WHEN has_eia = 0 THEN N'ไม่มี'
      ELSE NULL
    END
    WHERE eia_assessment IS NULL;
  `);

  await knex.schema.raw(`
    SELECT
      request_row.id AS request_id,
      COUNT(DISTINCT ef.id) AS match_count,
      MIN(ef.id) AS eligible_factory_id
    INTO #request_eligible_matches
    FROM ${REQUESTS_TABLE} AS request_row
    LEFT JOIN ${ELIGIBLE_FACTORIES_TABLE} AS ef
      ON ef.deleted_at IS NULL
      AND (
        ef.source_factory_id = request_row.factory_id
        OR ef.factory_registration_no_new = request_row.factory_id
        OR ef.factory_registration_no_new = request_row.factory_registration_no
      )
    WHERE request_row.deleted_at IS NULL
      AND request_row.status <> 'CANCELED'
    GROUP BY request_row.id;

    IF EXISTS (
      SELECT 1
      FROM #request_eligible_matches
      WHERE match_count <> 1
    )
    BEGIN
      THROW 51000, N'CONNECTION_REQUEST_ELIGIBLE_FACTORY_BACKFILL_FAILED', 1;
    END;

    UPDATE request_row
    SET request_row.eligible_factory_id = matches.eligible_factory_id
    FROM ${REQUESTS_TABLE} AS request_row
    INNER JOIN #request_eligible_matches AS matches
      ON matches.request_id = request_row.id
    WHERE matches.match_count = 1;

    DROP TABLE #request_eligible_matches;

    SELECT
      cp.id AS connected_point_id,
      COUNT(DISTINCT ef.id) AS match_count,
      MIN(ef.id) AS eligible_factory_id
    INTO #connected_point_eligible_matches
    FROM ${CONNECTED_POINTS_TABLE} AS cp
    LEFT JOIN ${ELIGIBLE_FACTORIES_TABLE} AS ef
      ON ef.deleted_at IS NULL
      AND (
        ef.source_factory_id = cp.factory_id
        OR ef.factory_registration_no_new = cp.factory_id
        OR ef.factory_registration_no_new = cp.factory_registration_no
      )
    WHERE cp.deleted_at IS NULL
    GROUP BY cp.id;

    IF EXISTS (
      SELECT 1
      FROM #connected_point_eligible_matches
      WHERE match_count <> 1
    )
    BEGIN
      DECLARE @problem_identifiers NVARCHAR(1800);
      DECLARE @error_message NVARCHAR(2048);

      SELECT @problem_identifiers = STRING_AGG(
        CONCAT(
          N'id=', cp.id,
          N',factory_id=', cp.factory_id,
          N',registration_no=', cp.factory_registration_no,
          N',matches=', matches.match_count
        ),
        N'; '
      )
      FROM #connected_point_eligible_matches AS matches
      INNER JOIN ${CONNECTED_POINTS_TABLE} AS cp
        ON cp.id = matches.connected_point_id
      WHERE matches.match_count <> 1;

      SET @error_message = CONCAT(
        N'POMS_ELIGIBLE_FACTORY_BACKFILL_FAILED: ',
        COALESCE(@problem_identifiers, N'unknown active POMS rows')
      );

      THROW 51000, @error_message, 1;
    END;

    UPDATE cp
    SET
      cp.eligible_factory_id = matches.eligible_factory_id,
      cp.factory_eia_assessment = request_row.eia_assessment,
      cp.factory_eia_other = request_row.eia_other,
      cp.factory_has_eia = request_row.has_eia,
      cp.factory_project_name = request_row.project_name
    FROM ${CONNECTED_POINTS_TABLE} AS cp
    INNER JOIN #connected_point_eligible_matches AS matches
      ON matches.connected_point_id = cp.id
    INNER JOIN ${REQUESTS_TABLE} AS request_row
      ON request_row.id = cp.source_request_id
    WHERE matches.match_count = 1;

    ;WITH latest_connected_factory_profile AS (
      SELECT
        matches.eligible_factory_id,
        request_row.latitude,
        request_row.longitude,
        request_row.eia_assessment,
        request_row.eia_other,
        request_row.has_eia,
        request_row.project_name,
        ROW_NUMBER() OVER (
          PARTITION BY matches.eligible_factory_id
          ORDER BY
            COALESCE(request_row.verified_at, request_row.updated_at, request_row.created_at) DESC,
            request_row.id DESC
        ) AS profile_rank
      FROM #connected_point_eligible_matches AS matches
      INNER JOIN ${CONNECTED_POINTS_TABLE} AS cp
        ON cp.id = matches.connected_point_id
      INNER JOIN ${REQUESTS_TABLE} AS request_row
        ON request_row.id = cp.source_request_id
      WHERE matches.match_count = 1
    )
    UPDATE eligible_row
    SET
      eligible_row.latitude = CASE
        WHEN request_row.latitude IS NOT NULL AND request_row.longitude IS NOT NULL
          THEN request_row.latitude
        ELSE eligible_row.latitude
      END,
      eligible_row.longitude = CASE
        WHEN request_row.latitude IS NOT NULL AND request_row.longitude IS NOT NULL
          THEN request_row.longitude
        ELSE eligible_row.longitude
      END,
      eligible_row.eia_assessment = COALESCE(
        request_row.eia_assessment,
        eligible_row.eia_assessment
      ),
      eligible_row.eia_other = CASE
        WHEN request_row.eia_assessment IS NULL THEN eligible_row.eia_other
        WHEN request_row.eia_assessment = N'อื่นๆ' THEN request_row.eia_other
        ELSE NULL
      END,
      eligible_row.has_eia = CASE
        WHEN request_row.eia_assessment IS NULL THEN eligible_row.has_eia
        ELSE request_row.has_eia
      END,
      eligible_row.project_name = COALESCE(request_row.project_name, eligible_row.project_name)
    FROM ${ELIGIBLE_FACTORIES_TABLE} AS eligible_row
    INNER JOIN latest_connected_factory_profile AS request_row
      ON request_row.eligible_factory_id = eligible_row.id
      AND request_row.profile_rank = 1;

    DROP TABLE #connected_point_eligible_matches;
  `);

  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT fk_connection_request_eligible_factory
    FOREIGN KEY (eligible_factory_id) REFERENCES ${ELIGIBLE_FACTORIES_TABLE}(id);

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD CONSTRAINT fk_connected_point_eligible_factory
    FOREIGN KEY (eligible_factory_id) REFERENCES ${ELIGIBLE_FACTORIES_TABLE}(id);

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD CONSTRAINT ck_active_connected_point_eligible_factory
    CHECK (deleted_at IS NOT NULL OR eligible_factory_id IS NOT NULL);

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD CONSTRAINT ck_connected_point_factory_profile_eia
    CHECK (
      factory_eia_assessment IS NULL
      OR factory_eia_assessment IN (N'มี', N'ไม่มี', N'มี IEE', N'มี EIA', N'มี EHIA', N'อื่นๆ')
    );

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD CONSTRAINT ck_connected_point_factory_front_photos_json
    CHECK (factory_front_photos_json IS NULL OR ISJSON(factory_front_photos_json) = 1);

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    ADD CONSTRAINT ck_connected_point_factory_logo_json
    CHECK (factory_logo_json IS NULL OR ISJSON(factory_logo_json) = 1);

    ALTER TABLE ${ELIGIBLE_FACTORIES_TABLE}
    ADD CONSTRAINT ck_eligible_factory_eia_assessment
    CHECK (
      eia_assessment IS NULL
      OR eia_assessment IN (N'มี', N'ไม่มี', N'มี IEE', N'มี EIA', N'มี EHIA', N'อื่นๆ')
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${ELIGIBLE_FACTORIES_TABLE}
    DROP CONSTRAINT ck_eligible_factory_eia_assessment;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP CONSTRAINT ck_connected_point_factory_logo_json;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP CONSTRAINT ck_connected_point_factory_front_photos_json;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP CONSTRAINT ck_connected_point_factory_profile_eia;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP CONSTRAINT ck_active_connected_point_eligible_factory;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP CONSTRAINT fk_connected_point_eligible_factory;

    ALTER TABLE ${REQUESTS_TABLE}
    DROP CONSTRAINT fk_connection_request_eligible_factory;

    ALTER TABLE ${ELIGIBLE_FACTORIES_TABLE}
    DROP COLUMN project_name, eia_other, eia_assessment;

    ALTER TABLE ${CONNECTED_POINTS_TABLE}
    DROP COLUMN
      factory_logo_json,
      factory_front_photos_json,
      factory_project_name,
      factory_has_eia,
      factory_eia_other,
      factory_eia_assessment,
      eligible_factory_id;

    ALTER TABLE ${REQUESTS_TABLE}
    DROP COLUMN eligible_factory_id;
  `);
}
