import type { Knex } from 'knex';

const TABLE_NAME = 'kwp05_calibration_items';
const CONSTRAINT_NAME = 'ck_kwp05_calibration_items_parameters_json';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    ADD parameters_json NVARCHAR(MAX) NULL;
  `);

  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME} WITH CHECK
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    CHECK (
      parameters_json IS NULL
      OR (
        ISJSON(parameters_json) = 1
        AND LEFT(LTRIM(parameters_json), 1) = N'['
        AND RIGHT(RTRIM(parameters_json), 1) = N']'
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    DROP CONSTRAINT ${CONSTRAINT_NAME};

    ALTER TABLE ${TABLE_NAME}
    DROP COLUMN parameters_json;
  `);
}
