import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kwp01_issue_reports', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('issue_reason', 'NVARCHAR(255)').notNullable();
    table.specificType('reason_detail', 'NVARCHAR(2000) NULL');
    table.specificType('problem_date', 'DATE NULL');
    table.specificType('expected_done_date', 'DATE NULL');
    table.integer('total_days').nullable();
    table.specificType('corrective_action', 'NVARCHAR(2000) NULL');

    table.unique(['submission_id'], { indexName: 'uq_kwp01_issue_submission' });
    table
      .foreign('submission_id', 'fk_kwp01_issue_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('kwp01_unreported_parameters', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('parameter_name', 'NVARCHAR(255)').notNullable();
    table.integer('sort_order').notNullable();

    table
      .foreign('submission_id', 'fk_kwp01_parameter_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.raw(`
    ALTER TABLE kwp01_issue_reports
    ADD CONSTRAINT ck_kwp01_issue_reason
    CHECK (issue_reason IN (N'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง', N'หยุดหน่วยการผลิต'));
  `);

  await knex.raw(`
    CREATE INDEX ix_kwp01_parameters_submission
    ON kwp01_unreported_parameters(submission_id, sort_order, id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX ix_kwp01_parameters_submission ON kwp01_unreported_parameters;');
  await knex.raw('ALTER TABLE kwp01_issue_reports DROP CONSTRAINT ck_kwp01_issue_reason;');
  await knex.schema.dropTableIfExists('kwp01_unreported_parameters');
  await knex.schema.dropTableIfExists('kwp01_issue_reports');
}
