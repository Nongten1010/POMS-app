import type { Knex } from 'knex';

const TABLE_NAME = 'kwp05_calibration_items';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  // Legacy question-mark values cannot be reconstructed safely because the API accepts free text.
  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN result NVARCHAR(32) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Fail before narrowing the type when the current collation cannot round-trip a stored value.
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${TABLE_NAME}
      WHERE result IS NOT NULL
        AND CONVERT(VARBINARY(64), result) <>
          CONVERT(
            VARBINARY(64),
            CONVERT(NVARCHAR(32), CONVERT(VARCHAR(32), result))
          )
    )
    BEGIN
      THROW 50093, N'Cannot convert KWP05 calibration results back to VARCHAR without data loss.', 1;
    END;

    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN result VARCHAR(32) NULL;
  `);
}
