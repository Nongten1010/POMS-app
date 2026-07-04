import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kwp03_wpms_issue_reports', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('wastewater_source', 'NVARCHAR(500) NULL');
    table.specificType('receiving_source', 'NVARCHAR(500) NULL');
    table.specificType('treatment_system_type', 'NVARCHAR(500) NULL');
    table.specificType('discharge_point', 'NVARCHAR(500) NULL');
    table.decimal('average_discharge', 18, 6).nullable();
    table.decimal('minimum_discharge', 18, 6).nullable();
    table.decimal('maximum_discharge', 18, 6).nullable();
    table.specificType('reason_detail', 'NVARCHAR(2000) NULL');
    table.specificType('problem_date', 'DATE NULL');
    table.specificType('expected_done_date', 'DATE NULL');
    table.integer('total_days').nullable();
    table.specificType('corrective_action', 'NVARCHAR(2000) NULL');

    table.unique(['submission_id'], { indexName: 'uq_kwp03_issue_submission' });
    table
      .foreign('submission_id', 'fk_kwp03_issue_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('kwp03_selected_options', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('option_group', 'VARCHAR(32)').notNullable();
    table.specificType('option_value', 'NVARCHAR(255)').notNullable();
    table.integer('sort_order').notNullable();

    table
      .foreign('submission_id', 'fk_kwp03_option_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.raw(`
    ALTER TABLE kwp03_selected_options
    ADD CONSTRAINT ck_kwp03_option_group
    CHECK (option_group IN ('INSTRUMENT', 'MEASUREMENT_TIME', 'ISSUE_REASON', 'FAILED_PARAMETER'));
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp03_options_submission_group
    ON kwp03_selected_options(submission_id, option_group, sort_order, id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX ix_kwp03_options_submission_group ON kwp03_selected_options;');
  await knex.raw('ALTER TABLE kwp03_selected_options DROP CONSTRAINT ck_kwp03_option_group;');
  await knex.schema.dropTableIfExists('kwp03_selected_options');
  await knex.schema.dropTableIfExists('kwp03_wpms_issue_reports');
}
