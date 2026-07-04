import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kwp05_calibration_reports', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('business_activity', 'NVARCHAR(500) NULL');
    table.specificType('sampler_name', 'NVARCHAR(255) NULL');
    table.specificType('officer_registration', 'NVARCHAR(100) NULL');
    table.specificType('laboratory_name', 'NVARCHAR(500) NULL');
    table.specificType('laboratory_registration', 'NVARCHAR(100) NULL');
    table.specificType('cems_brand', 'NVARCHAR(255) NULL');
    table.specificType('cems_detail', 'NVARCHAR(1000) NULL');
    table.specificType('report_round', 'NVARCHAR(100) NULL');
    table.specificType('report_year', 'VARCHAR(4) NULL');

    table.unique(['submission_id'], { indexName: 'uq_kwp05_report_submission' });
    table
      .foreign('submission_id', 'fk_kwp05_report_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('kwp05_calibration_items', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('parameter_name', 'NVARCHAR(255)').notNullable();
    table.specificType('start_date', 'DATE NULL');
    table.specificType('end_date', 'DATE NULL');
    table.specificType('result', 'VARCHAR(32) NULL');
    table.specificType('verifier_company', 'NVARCHAR(500) NULL');
    table.specificType('cems_model', 'NVARCHAR(500) NULL');
    table.specificType('link_qr1', 'NVARCHAR(1000) NULL');
    table.specificType('link_qr2', 'NVARCHAR(1000) NULL');
    table.integer('sort_order').notNullable();

    table
      .foreign('submission_id', 'fk_kwp05_item_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.raw(`
    CREATE INDEX ix_kwp05_calibration_items_submission
    ON kwp05_calibration_items(submission_id, sort_order, id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX ix_kwp05_calibration_items_submission ON kwp05_calibration_items;');
  await knex.schema.dropTableIfExists('kwp05_calibration_items');
  await knex.schema.dropTableIfExists('kwp05_calibration_reports');
}
