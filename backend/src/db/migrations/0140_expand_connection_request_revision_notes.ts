import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  // SQL Server requires MAX above 4000 Unicode code units. History can contain
  // two distinct 5000-character notes separated by a newline (10001 total).
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests ALTER COLUMN revision_reason NVARCHAR(MAX) NULL;
    ALTER TABLE cems_wpms_connection_requests ALTER COLUMN officer_note NVARCHAR(MAX) NULL;
    ALTER TABLE cems_wpms_request_status_history ALTER COLUMN note NVARCHAR(MAX) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1 FROM cems_wpms_connection_requests
      WHERE DATALENGTH(revision_reason) > 2000 OR DATALENGTH(officer_note) > 2000
    ) OR EXISTS (
      SELECT 1 FROM cems_wpms_request_status_history WHERE DATALENGTH(note) > 4002
    )
    BEGIN
      THROW 50001, 'Cannot shrink connection request revision notes while longer notes exist', 1;
    END;
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests ALTER COLUMN revision_reason NVARCHAR(1000) NULL;
    ALTER TABLE cems_wpms_connection_requests ALTER COLUMN officer_note NVARCHAR(1000) NULL;
    ALTER TABLE cems_wpms_request_status_history ALTER COLUMN note NVARCHAR(2001) NULL;
  `);
}
