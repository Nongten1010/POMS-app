import type { Knex } from 'knex';

const KWP01_TABLE = 'kwp01_issue_reports';
const KWP03_TABLE = 'kwp03_wpms_issue_reports';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(KWP01_TABLE, (table) => {
    table.specificType('problem_datetime', 'DATETIME2(0) NULL');
    table.specificType('expected_done_datetime', 'DATETIME2(0) NULL');
    table.integer('total_hours').nullable();
  });

  await knex.schema.alterTable(KWP03_TABLE, (table) => {
    table.specificType('problem_datetime', 'DATETIME2(0) NULL');
    table.specificType('expected_done_datetime', 'DATETIME2(0) NULL');
    table.integer('total_hours').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(KWP03_TABLE, (table) => {
    table.dropColumn('total_hours');
    table.dropColumn('expected_done_datetime');
    table.dropColumn('problem_datetime');
  });

  await knex.schema.alterTable(KWP01_TABLE, (table) => {
    table.dropColumn('total_hours');
    table.dropColumn('expected_done_datetime');
    table.dropColumn('problem_datetime');
  });
}
