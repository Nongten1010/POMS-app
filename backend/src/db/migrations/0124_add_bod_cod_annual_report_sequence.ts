import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bod_cod_deviation_reports', (table) => {
    table.integer('report_sequence_no').nullable();
  });
  // Preserve legacy NULLs: report_round and the document counter are not annual sequences.
  await knex.raw(`
    ALTER TABLE bod_cod_deviation_reports ADD CONSTRAINT ck_bodcod_annual_sequence
      CHECK (report_sequence_no IS NULL OR report_sequence_no > 0);
    CREATE INDEX ix_bodcod_point_parameter_year
      ON bod_cod_deviation_reports(connected_measurement_point_id, selected_parameter_code, report_year)
      INCLUDE (status, report_sequence_no, point_code, factory_registration_no)
      WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX ix_bodcod_point_parameter_year ON bod_cod_deviation_reports;
    ALTER TABLE bod_cod_deviation_reports DROP CONSTRAINT ck_bodcod_annual_sequence;
  `);
  await knex.schema.alterTable('bod_cod_deviation_reports', (table) => {
    table.dropColumn('report_sequence_no');
  });
}
