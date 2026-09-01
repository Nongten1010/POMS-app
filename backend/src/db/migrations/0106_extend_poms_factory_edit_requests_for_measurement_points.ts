import type { Knex } from 'knex';

const REQUESTS_TABLE = 'poms_factory_edit_requests';
const OPEN_FACTORY_INDEX = 'uq_poms_factory_edit_requests_open_factory';
const FORM_TYPE_DEFAULT = 'df_poms_factory_edit_requests_form_type';
const FORM_TYPE_CHECK = 'ck_poms_factory_edit_requests_form_type';
const CURRENT_POINTS_CHECK = 'ck_poms_factory_edit_requests_current_measurement_points_json';
const PROPOSED_POINTS_CHECK = 'ck_poms_factory_edit_requests_proposed_measurement_points_json';
const SNAPSHOT_STATE_CHECK = 'ck_poms_factory_edit_requests_form_snapshots';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    ADD form_type VARCHAR(32) NOT NULL
      CONSTRAINT ${FORM_TYPE_DEFAULT} DEFAULT 'BASIC_INFO' WITH VALUES;

    ALTER TABLE ${REQUESTS_TABLE}
    ADD current_measurement_points_json NVARCHAR(MAX) NULL,
        proposed_measurement_points_json NVARCHAR(MAX) NULL;
  `);

  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${FORM_TYPE_CHECK}
    CHECK (form_type IN ('BASIC_INFO', 'MEASUREMENT_POINTS'));

    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${CURRENT_POINTS_CHECK}
    CHECK (
      current_measurement_points_json IS NULL
      OR (
        ISJSON(current_measurement_points_json) = 1
        AND LEFT(LTRIM(current_measurement_points_json), 1) = N'['
      )
    );

    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${PROPOSED_POINTS_CHECK}
    CHECK (
      proposed_measurement_points_json IS NULL
      OR (
        ISJSON(proposed_measurement_points_json) = 1
        AND LEFT(LTRIM(proposed_measurement_points_json), 1) = N'['
      )
    );

    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${SNAPSHOT_STATE_CHECK}
    CHECK (
      (
        form_type = 'BASIC_INFO'
        AND current_measurement_points_json IS NULL
        AND proposed_measurement_points_json IS NULL
      )
      OR (
        form_type = 'MEASUREMENT_POINTS'
        AND current_measurement_points_json IS NOT NULL
        AND proposed_measurement_points_json IS NOT NULL
      )
    );

    DROP INDEX ${OPEN_FACTORY_INDEX} ON ${REQUESTS_TABLE};

    CREATE UNIQUE INDEX ${OPEN_FACTORY_INDEX}
    ON ${REQUESTS_TABLE}(eligible_factory_id, form_type)
    WHERE deleted_at IS NULL AND is_open = 1;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${REQUESTS_TABLE}
      WHERE form_type = 'MEASUREMENT_POINTS'
    )
    BEGIN
      THROW 50001, 'Cannot roll back measurement-point edit requests while their data exists', 1;
    END;

    DROP INDEX ${OPEN_FACTORY_INDEX} ON ${REQUESTS_TABLE};

    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${SNAPSHOT_STATE_CHECK};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${PROPOSED_POINTS_CHECK};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${CURRENT_POINTS_CHECK};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${FORM_TYPE_CHECK};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${FORM_TYPE_DEFAULT};

    ALTER TABLE ${REQUESTS_TABLE}
    DROP COLUMN proposed_measurement_points_json,
                current_measurement_points_json,
                form_type;

    CREATE UNIQUE INDEX ${OPEN_FACTORY_INDEX}
    ON ${REQUESTS_TABLE}(eligible_factory_id)
    WHERE deleted_at IS NULL AND is_open = 1;
  `);
}
