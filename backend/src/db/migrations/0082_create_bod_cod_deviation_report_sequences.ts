import type { Knex } from 'knex';

const SEQUENCES_TABLE = 'bod_cod_deviation_report_sequences';
const REPORTS_TABLE = 'bod_cod_deviation_reports';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(SEQUENCES_TABLE, (table) => {
    table.specificType('region_code', 'CHAR(2) NOT NULL');
    table.specificType('report_year', 'INT NOT NULL');
    table.specificType(
      'last_sequence',
      'INT NOT NULL CONSTRAINT df_bod_cod_deviation_report_sequences_last_sequence DEFAULT 0',
    );
    table.specificType(
      'updated_at',
      'DATETIME2 NOT NULL CONSTRAINT df_bod_cod_deviation_report_sequences_updated_at DEFAULT SYSDATETIME()',
    );
    table.primary(['region_code', 'report_year'], {
      constraintName: 'pk_bod_cod_deviation_report_sequences',
    });
  });

  await knex.schema.alterTable(REPORTS_TABLE, (table) => {
    table.specificType('numbering_region_code', 'CHAR(2) NULL');
    table.specificType('numbering_sequence', 'INT NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_bod_cod_deviation_report_sequences_region_code
    CHECK (region_code IN ('02', '03', '04', '05', '06', '07'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_bod_cod_deviation_report_sequences_report_year
    CHECK (report_year BETWEEN 2500 AND 2700);
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_bod_cod_deviation_report_sequences_last_sequence
    CHECK (last_sequence BETWEEN 0 AND 9999);
  `);

  await knex.schema.raw(`
    ALTER TABLE ${REPORTS_TABLE}
    ADD CONSTRAINT ck_bod_cod_deviation_reports_numbering_snapshot
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

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${REPORTS_TABLE}
    DROP CONSTRAINT ck_bod_cod_deviation_reports_numbering_snapshot;
  `);
  await knex.schema.alterTable(REPORTS_TABLE, (table) => {
    table.dropColumn('numbering_region_code');
    table.dropColumn('numbering_sequence');
  });
  await knex.schema.dropTableIfExists(SEQUENCES_TABLE);
}
