import type { Knex } from 'knex';

export const config = { transaction: true };
const historyTables = ['cems_wpms_request_status_history', 'kwp_form_status_history'];

export async function up(knex: Knex): Promise<void> {
  await resizeHistoryNotes(knex, 2001);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1 FROM cems_wpms_request_status_history WHERE DATALENGTH(note) > 2000
    ) OR EXISTS (
      SELECT 1 FROM kwp_form_status_history WHERE DATALENGTH(note) > 2000
    )
    BEGIN
      THROW 50001, 'Cannot shrink rejection history notes while longer audit notes exist', 1;
    END;
  `);
  await resizeHistoryNotes(knex, 1000);
}

async function resizeHistoryNotes(knex: Knex, length: number): Promise<void> {
  for (const table of historyTables) {
    await knex.schema.raw(`ALTER TABLE ${table} ALTER COLUMN note NVARCHAR(${length}) NULL;`);
  }
}
