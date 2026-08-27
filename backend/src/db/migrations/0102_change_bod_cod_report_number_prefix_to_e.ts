import type { Knex } from 'knex';

const REPORTS_TABLE = 'bod_cod_deviation_reports';
const NUMBERING_CONSTRAINT = 'ck_bod_cod_deviation_reports_numbering_snapshot';

export const config = { transaction: true } as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${REPORTS_TABLE} AS report WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN ${REPORTS_TABLE} AS occupied_report WITH (UPDLOCK, HOLDLOCK)
        ON occupied_report.report_no = STUFF(report.report_no, 1, 6, 'E-')
       AND occupied_report.id <> report.id
      WHERE report.numbering_region_code IS NOT NULL
        AND report.numbering_sequence IS NOT NULL
    )
    BEGIN
      THROW 51102, N'BOD_COD_REPORT_NO_PREFIX_COLLISION', 1;
    END;

    ALTER TABLE ${REPORTS_TABLE}
    DROP CONSTRAINT ${NUMBERING_CONSTRAINT};

    UPDATE ${REPORTS_TABLE}
    SET report_no = STUFF(report_no, 1, 6, 'E-')
    WHERE numbering_region_code IS NOT NULL
      AND numbering_sequence IS NOT NULL;

    ALTER TABLE ${REPORTS_TABLE} WITH CHECK
    ADD CONSTRAINT ${NUMBERING_CONSTRAINT}
    CHECK (
      (
        numbering_region_code IS NULL
        AND numbering_sequence IS NULL
        AND report_no NOT LIKE 'E-[0-9][0-9]-[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'
      )
      OR
      (
        numbering_region_code IS NOT NULL
        AND numbering_sequence IS NOT NULL
        AND numbering_region_code IN ('02', '03', '04', '05', '06', '07')
        AND numbering_sequence BETWEEN 1 AND 9999
        AND report_no = CONCAT(
          'E-', numbering_region_code,
          '-', RIGHT('0000' + CONVERT(VARCHAR(4), numbering_sequence), 4),
          '/', CONVERT(VARCHAR(4), report_year)
        )
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${REPORTS_TABLE} AS report WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN ${REPORTS_TABLE} AS occupied_report WITH (UPDLOCK, HOLDLOCK)
        ON occupied_report.report_no = STUFF(report.report_no, 1, 2, 'Error-')
       AND occupied_report.id <> report.id
      WHERE report.numbering_region_code IS NOT NULL
        AND report.numbering_sequence IS NOT NULL
    )
    BEGIN
      THROW 51102, N'BOD_COD_REPORT_NO_PREFIX_ROLLBACK_COLLISION', 1;
    END;

    ALTER TABLE ${REPORTS_TABLE}
    DROP CONSTRAINT ${NUMBERING_CONSTRAINT};

    UPDATE ${REPORTS_TABLE}
    SET report_no = STUFF(report_no, 1, 2, 'Error-')
    WHERE numbering_region_code IS NOT NULL
      AND numbering_sequence IS NOT NULL;

    ALTER TABLE ${REPORTS_TABLE} WITH CHECK
    ADD CONSTRAINT ${NUMBERING_CONSTRAINT}
    CHECK (
      (
        numbering_region_code IS NULL
        AND numbering_sequence IS NULL
        AND report_no NOT LIKE 'Error-[0-9][0-9]-[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'
      )
      OR
      (
        numbering_region_code IS NOT NULL
        AND numbering_sequence IS NOT NULL
        AND numbering_region_code IN ('02', '03', '04', '05', '06', '07')
        AND numbering_sequence BETWEEN 1 AND 9999
        AND report_no = CONCAT(
          'Error-', numbering_region_code,
          '-', RIGHT('0000' + CONVERT(VARCHAR(4), numbering_sequence), 4),
          '/', CONVERT(VARCHAR(4), report_year)
        )
      )
    );
  `);
}
