import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const TABLE_NAME = 'bod_cod_result_notices';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('report_id').notNullable();
    table.specificType('report_correctness', 'NVARCHAR(64) NOT NULL');
    table.specificType('checked_parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('review_result', 'NVARCHAR(255) NOT NULL');
    table.specificType('comment', 'NVARCHAR(1000) NULL');
    table.specificType('inspector_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('inspector_position', 'NVARCHAR(255) NOT NULL');
    addAuditColumns(table);

    table
      .foreign('report_id', 'fk_bodcod_result_notice_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
    table
      .foreign('created_by', 'fk_bodcod_result_notice_created_by')
      .references('id')
      .inTable('users');
    table
      .foreign('updated_by', 'fk_bodcod_result_notice_updated_by')
      .references('id')
      .inTable('users');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_bodcod_result_notice_report
    ON ${TABLE_NAME}(report_id)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
