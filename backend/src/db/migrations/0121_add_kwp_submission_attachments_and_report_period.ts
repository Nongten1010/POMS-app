import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('kwp_form_submissions', (table) => {
    table.specificType('attachment_link', 'NVARCHAR(1000) NULL');
    table.specificType('sampling_photo_link', 'NVARCHAR(1000) NULL');
    table.specificType('lab_report_link', 'NVARCHAR(1000) NULL');
    table.integer('report_round').nullable();
    table.integer('report_year').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const populated = await knex('kwp_form_submissions')
    .where((query) => {
      for (const column of [
        'attachment_link',
        'sampling_photo_link',
        'lab_report_link',
        'report_round',
        'report_year',
      ]) {
        query.orWhereNotNull(column);
      }
    })
    .first('id');
  if (populated) throw new Error('Cannot remove KWP handoff columns while they contain data');
  await knex.schema.alterTable('kwp_form_submissions', (table) => {
    table.dropColumns(
      'attachment_link',
      'sampling_photo_link',
      'lab_report_link',
      'report_round',
      'report_year',
    );
  });
}
