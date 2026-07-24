import type { Knex } from 'knex';

const SEQUENCES_TABLE = 'kwp_form_submission_sequences';
const SUBMISSIONS_TABLE = 'kwp_form_submissions';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(SEQUENCES_TABLE, (table) => {
    table.specificType('form_type', 'VARCHAR(16) NOT NULL');
    table.specificType('region_code', 'CHAR(2) NOT NULL');
    table.specificType('buddhist_year', 'CHAR(4) NOT NULL');
    table.specificType(
      'last_sequence',
      'INT NOT NULL CONSTRAINT df_kwp_form_submission_sequences_last_sequence DEFAULT 0',
    );
    table.specificType(
      'updated_at',
      'DATETIME2 NOT NULL CONSTRAINT df_kwp_form_submission_sequences_updated_at DEFAULT SYSDATETIME()',
    );
    table.primary(['form_type', 'region_code', 'buddhist_year'], {
      constraintName: 'pk_kwp_form_submission_sequences',
    });
  });

  await knex.schema.alterTable(SUBMISSIONS_TABLE, (table) => {
    table.specificType('submission_region_code', 'CHAR(2) NULL');
    table.specificType('submission_region_name', 'NVARCHAR(128) NULL');
    table.specificType('submission_buddhist_year', 'CHAR(4) NULL');
    table.specificType('submission_sequence', 'INT NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_kwp_form_submission_sequences_form_type
    CHECK (form_type IN ('KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_kwp_form_submission_sequences_region_code
    CHECK (region_code IN ('02', '03', '04', '05', '06', '07'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_kwp_form_submission_sequences_buddhist_year
    CHECK (buddhist_year LIKE '[0-9][0-9][0-9][0-9]');
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_kwp_form_submission_sequences_last_sequence
    CHECK (last_sequence BETWEEN 0 AND 9999);
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SUBMISSIONS_TABLE}
    ADD CONSTRAINT ck_kwp_form_submissions_numbering_snapshot
    CHECK (
      (
        submission_region_code IS NULL
        AND submission_region_name IS NULL
        AND submission_buddhist_year IS NULL
        AND submission_sequence IS NULL
        AND submission_no NOT LIKE
          'F[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'
      )
      OR
      (
        submission_region_code IS NOT NULL
        AND submission_region_name IS NOT NULL
        AND LEN(LTRIM(RTRIM(submission_region_name))) > 0
        AND submission_buddhist_year IS NOT NULL
        AND submission_sequence IS NOT NULL
        AND submission_region_code IN ('02', '03', '04', '05', '06', '07')
        AND (
          (submission_region_code = '02' AND submission_region_name = N'ภาคตะวันตก')
          OR (submission_region_code = '03' AND submission_region_name = N'ภาคตะวันออก')
          OR (submission_region_code = '04' AND submission_region_name = N'ภาคเหนือ')
          OR (submission_region_code = '05' AND submission_region_name = N'ภาคใต้')
          OR (
            submission_region_code = '06'
            AND submission_region_name = N'ภาคตะวันออกเฉียงเหนือ'
          )
          OR (submission_region_code = '07' AND submission_region_name = N'ภาคกลาง')
        )
        AND submission_buddhist_year LIKE '[0-9][0-9][0-9][0-9]'
        AND submission_sequence BETWEEN 1 AND 9999
        AND submission_no = CONCAT(
          'F', RIGHT(form_type, 2),
          '-', submission_region_code,
          '-', RIGHT('0000' + CONVERT(VARCHAR(4), submission_sequence), 4),
          '/', submission_buddhist_year
        )
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${SUBMISSIONS_TABLE}
    DROP CONSTRAINT ck_kwp_form_submissions_numbering_snapshot;
  `);
  await knex.schema.alterTable(SUBMISSIONS_TABLE, (table) => {
    table.dropColumn('submission_region_code');
    table.dropColumn('submission_region_name');
    table.dropColumn('submission_buddhist_year');
    table.dropColumn('submission_sequence');
  });
  await knex.schema.dropTableIfExists(SEQUENCES_TABLE);
}
