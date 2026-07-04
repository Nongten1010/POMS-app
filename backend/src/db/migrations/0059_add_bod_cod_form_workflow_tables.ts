import type { Knex } from 'knex';
import { addTimestamps } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bod_cod_deviation_attachments', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('report_id').notNullable();
    table.specificType('attachment_type', 'VARCHAR(64) NOT NULL');
    table.specificType('original_file_name', 'NVARCHAR(500) NOT NULL');
    table.specificType('stored_file_name', 'NVARCHAR(500) NULL');
    table.specificType('mime_type', 'NVARCHAR(128) NULL');
    table.bigInteger('file_size').nullable();
    table.specificType('storage_path', 'NVARCHAR(1000) NULL');
    table.bigInteger('uploaded_by').nullable();
    table.specificType('uploaded_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    addTimestamps(table);
    table.specificType('deleted_at', 'DATETIME2 NULL');
    table
      .foreign('report_id', 'fk_bodcod_attachment_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
  });

  await knex.schema.createTable('bod_cod_approval_steps', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('report_id').notNullable();
    table.specificType('track', 'VARCHAR(16) NOT NULL');
    table.integer('step_no').notNullable();
    table.specificType('role_code', 'VARCHAR(32) NOT NULL');
    table.specificType('role_label', 'NVARCHAR(120) NOT NULL');
    table.specificType('status', "VARCHAR(32) NOT NULL DEFAULT 'WAITING'");
    table.bigInteger('actor_user_id').nullable();
    table.specificType('actor_name', 'NVARCHAR(255) NULL');
    table.specificType('actor_position', 'NVARCHAR(255) NULL');
    table.specificType('decision', 'VARCHAR(32) NULL');
    table.specificType('comment', 'NVARCHAR(MAX) NULL');
    table.specificType('decided_at', 'DATETIME2 NULL');
    table.integer('revision_no').notNullable().defaultTo(1);
    table.boolean('is_current').notNullable().defaultTo(false);
    addTimestamps(table);
    table.specificType('deleted_at', 'DATETIME2 NULL');
    table
      .foreign('report_id', 'fk_bodcod_step_report')
      .references('id')
      .inTable('bod_cod_deviation_reports');
    table.unique(['report_id', 'revision_no', 'step_no'], {
      indexName: 'uq_bodcod_step_report_revision_step',
    });
  });

  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_attachments_report
    ON bod_cod_deviation_attachments(report_id, id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_bodcod_steps_report
    ON bod_cod_approval_steps(report_id, step_no)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bod_cod_approval_steps');
  await knex.schema.dropTableIfExists('bod_cod_deviation_attachments');
}
