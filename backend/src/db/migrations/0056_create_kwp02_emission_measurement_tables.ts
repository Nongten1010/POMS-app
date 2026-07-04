import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kwp_emission_measurement_items', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('pollutant', 'NVARCHAR(255)').notNullable();
    table.specificType('sample_date', 'DATE NULL');
    table.decimal('measured_value', 18, 6).nullable();
    table.specificType('measured_value_text', 'NVARCHAR(100) NULL');
    table.specificType('unit', 'NVARCHAR(64) NULL');
    table.specificType('laboratory_no', 'NVARCHAR(100) NULL');
    table.specificType('report_no', 'NVARCHAR(100) NULL');
    table.specificType('method', 'NVARCHAR(1000) NULL');
    table.integer('sort_order').notNullable();

    table
      .foreign('submission_id', 'fk_kwp_emission_item_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('kwp_form_attachments', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('related_table', 'VARCHAR(64) NULL');
    table.bigInteger('related_id').nullable();
    table.specificType('attachment_type', 'VARCHAR(64)').notNullable();
    table.specificType('original_file_name', 'NVARCHAR(500)').notNullable();
    table.specificType('stored_file_name', 'NVARCHAR(500) NULL');
    table.specificType('mime_type', 'VARCHAR(128) NULL');
    table.bigInteger('file_size').nullable();
    table.specificType('storage_path', 'NVARCHAR(1000) NULL');
    table.specificType('uploaded_at', 'DATETIME2').notNullable().defaultTo(knex.fn.now());
    table.bigInteger('uploaded_by').nullable();
    table.specificType('deleted_at', 'DATETIME2 NULL');

    table
      .foreign('submission_id', 'fk_kwp_attachment_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
    table.foreign('uploaded_by', 'fk_kwp_attachment_uploaded_by').references('id').inTable('users');
  });

  await knex.raw(`
    CREATE INDEX ix_kwp_emission_items_submission
    ON kwp_emission_measurement_items(submission_id, sort_order, id);
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_attachments_submission
    ON kwp_form_attachments(submission_id, attachment_type, id)
    WHERE deleted_at IS NULL;
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_attachments_related
    ON kwp_form_attachments(related_table, related_id)
    WHERE deleted_at IS NULL AND related_table IS NOT NULL AND related_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX ix_kwp_attachments_related ON kwp_form_attachments;');
  await knex.raw('DROP INDEX ix_kwp_attachments_submission ON kwp_form_attachments;');
  await knex.raw('DROP INDEX ix_kwp_emission_items_submission ON kwp_emission_measurement_items;');
  await knex.schema.dropTableIfExists('kwp_form_attachments');
  await knex.schema.dropTableIfExists('kwp_emission_measurement_items');
}
