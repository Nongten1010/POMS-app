import type { Knex } from 'knex';
import { addTimestamps } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bod_cod_deviation_reports', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('report_no', 'VARCHAR(40) NOT NULL');
    table.integer('report_round').notNullable();
    table.integer('report_year').notNullable();
    table.bigInteger('factory_id').nullable();
    table.bigInteger('connected_measurement_point_id').nullable();
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('point_name', 'NVARCHAR(255) NULL');
    table.specificType('factory_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('factory_registration_no', 'NVARCHAR(80) NOT NULL');
    table.specificType('business_activity', 'NVARCHAR(255) NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('province_name', 'NVARCHAR(120) NOT NULL');
    table.specificType('approval_track', 'VARCHAR(16) NOT NULL');
    table.specificType('selected_parameter_code', 'VARCHAR(8) NOT NULL');
    table.decimal('wastewater_flow_m3_per_hour', 12, 2).nullable();
    table.specificType('sampler_name', 'NVARCHAR(255) NULL');
    table.specificType('officer_registration_no', 'NVARCHAR(80) NULL');
    table.specificType('laboratory_name', 'NVARCHAR(255) NULL');
    table.specificType('laboratory_registration_no', 'NVARCHAR(80) NULL');
    table.specificType('lab_report_no', 'NVARCHAR(120) NULL');
    table.specificType('analysis_method', 'NVARCHAR(255) NULL');
    table.specificType('device_brand', 'NVARCHAR(120) NULL');
    table.specificType('device_model', 'NVARCHAR(120) NULL');
    table.specificType('device_serial_no', 'NVARCHAR(120) NULL');
    table.specificType('reporter_name', 'NVARCHAR(255) NULL');
    table.specificType('reporter_position', 'NVARCHAR(255) NULL');
    table.specificType('status', "VARCHAR(32) NOT NULL DEFAULT 'DRAFT'");
    table.specificType('submitted_at', 'DATETIME2 NULL');
    table.bigInteger('created_by').notNullable();
    table.bigInteger('updated_by').nullable();
    addTimestamps(table);
    table.specificType('deleted_at', 'DATETIME2 NULL');
    table.foreign('factory_id', 'fk_bodcod_report_factory').references('id').inTable('factories');
    table
      .foreign('connected_measurement_point_id', 'fk_bodcod_report_connected_point')
      .references('id')
      .inTable('cems_wpms_connected_measurement_points');
    table.unique(['report_no'], { indexName: 'uq_bodcod_report_no' });
  });

  await knex.schema.createTable('bod_cod_deviation_measurements', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('report_id').notNullable();
    table.specificType('parameter_code', 'VARCHAR(8) NOT NULL');
    table.specificType('sample_date', 'DATE NOT NULL');
    table.specificType('sample_time', 'TIME(0) NOT NULL');
    table.decimal('device_value_mg_l', 12, 3).notNullable();
    table.decimal('lab_value_mg_l', 12, 3).notNullable();
    table.specificType('deviation_value_mg_l', 'AS (device_value_mg_l - lab_value_mg_l)');
    table.decimal('standard_deviation_mg_l', 12, 3).nullable();
    table.boolean('is_within_standard').nullable();
    table.integer('sort_order').notNullable().defaultTo(1);
    addTimestamps(table);
    table.specificType('deleted_at', 'DATETIME2 NULL');
    table
      .foreign('report_id', 'fk_bodcod_measure_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
  });

  await knex.schema.createTable('bod_cod_deviation_reviews', (table) => {
    table.bigInteger('report_id').primary();
    table.specificType('selected_parameter_code', 'VARCHAR(8) NOT NULL');
    table.specificType('form_check_result', 'VARCHAR(16) NULL');
    table.specificType('form_check_reason', 'NVARCHAR(MAX) NULL');
    table.specificType('deviation_check_result', 'VARCHAR(20) NULL');
    table.specificType('deviation_check_reason', 'NVARCHAR(MAX) NULL');
    table.boolean('regulator_notice_required').notNullable().defaultTo(false);
    table.bigInteger('updated_by').nullable();
    table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table
      .foreign('report_id', 'fk_bodcod_review_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_reports_status_created
    ON bod_cod_deviation_reports(status, created_at DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_reports_factory
    ON bod_cod_deviation_reports(factory_id, created_at DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_reports_connected_point_round
    ON bod_cod_deviation_reports(connected_measurement_point_id, report_year, report_round)
    WHERE deleted_at IS NULL AND connected_measurement_point_id IS NOT NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_reports_province
    ON bod_cod_deviation_reports(province_name, created_at DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_measurements_report
    ON bod_cod_deviation_measurements(report_id, sort_order)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bod_cod_deviation_reviews');
  await knex.schema.dropTableIfExists('bod_cod_deviation_measurements');
  await knex.schema.dropTableIfExists('bod_cod_deviation_reports');
}
