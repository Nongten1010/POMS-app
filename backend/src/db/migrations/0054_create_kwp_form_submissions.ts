import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kwp_form_submissions', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('submission_no', 'VARCHAR(32)').notNullable();
    table.specificType('form_type', 'VARCHAR(16)').notNullable();
    table.specificType('status', 'VARCHAR(32)').notNullable().defaultTo('DRAFT');
    table.specificType('factory_id', 'VARCHAR(64) NULL');
    table.specificType('factory_name', 'NVARCHAR(500)').notNullable();
    table.specificType('factory_registration_no', 'NVARCHAR(64) NULL');
    table.specificType('factory_address', 'NVARCHAR(1000) NULL');
    table.specificType('industry_type', 'NVARCHAR(255) NULL');
    table.bigInteger('connected_point_id').nullable();
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('point_name', 'NVARCHAR(255) NULL');
    table.specificType('point_type', 'VARCHAR(32) NULL');
    table.specificType('production_stack', 'NVARCHAR(255) NULL');
    table.specificType('primary_fuel', 'NVARCHAR(255) NULL');
    table.specificType('secondary_fuel', 'NVARCHAR(255) NULL');
    table.specificType('combustion_system', 'NVARCHAR(64) NULL');
    table.specificType('production_capacity', 'NVARCHAR(255) NULL');
    table.specificType('production_capacity_unit', 'NVARCHAR(64) NULL');
    table.specificType('contact_name', 'NVARCHAR(255) NULL');
    table.specificType('contact_phone', 'VARCHAR(64) NULL');
    table.specificType('contact_email', 'VARCHAR(255) NULL');
    table.specificType('reporter_name', 'NVARCHAR(255) NULL');
    table.specificType('reporter_position', 'NVARCHAR(255) NULL');
    table.specificType('submitted_at', 'DATETIME2 NULL');
    table.specificType('reviewed_at', 'DATETIME2 NULL');
    table.bigInteger('reviewed_by').nullable();
    table.specificType('officer_note', 'NVARCHAR(1000) NULL');
    table.specificType('created_at', 'DATETIME2').notNullable().defaultTo(knex.fn.now());
    table.specificType('updated_at', 'DATETIME2').notNullable().defaultTo(knex.fn.now());
    table.bigInteger('created_by').nullable();
    table.bigInteger('updated_by').nullable();
    table.specificType('deleted_at', 'DATETIME2 NULL');

    table.unique(['submission_no'], { indexName: 'uq_kwp_submission_no' });
    table
      .foreign('connected_point_id', 'fk_kwp_submission_connected_point')
      .references('id')
      .inTable('cems_wpms_connected_measurement_points');
  });

  await knex.schema.createTable('kwp_form_status_history', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('submission_id').notNullable();
    table.specificType('status', 'VARCHAR(32)').notNullable();
    table.specificType('note', 'NVARCHAR(1000) NULL');
    table.bigInteger('changed_by').nullable();
    table.specificType('changed_at', 'DATETIME2').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('submission_id', 'fk_kwp_status_history_submission')
      .references('id')
      .inTable('kwp_form_submissions')
      .onDelete('CASCADE');
    table.foreign('changed_by', 'fk_kwp_status_history_changed_by').references('id').inTable('users');
  });

  await knex.raw(`
    ALTER TABLE kwp_form_submissions
    ADD CONSTRAINT ck_kwp_form_type
    CHECK (form_type IN ('KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'));
  `);
  await knex.raw(`
    ALTER TABLE kwp_form_submissions
    ADD CONSTRAINT ck_kwp_form_status
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'CANCELLED'));
  `);
  await knex.raw(`
    ALTER TABLE kwp_form_status_history
    ADD CONSTRAINT ck_kwp_status_history_status
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'CANCELLED'));
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_forms_type_status_created
    ON kwp_form_submissions(form_type, status, created_at)
    WHERE deleted_at IS NULL;
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_forms_factory
    ON kwp_form_submissions(factory_id, factory_registration_no)
    WHERE deleted_at IS NULL;
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_forms_point_code
    ON kwp_form_submissions(point_code)
    WHERE deleted_at IS NULL;
  `);
  await knex.raw(`
    CREATE INDEX ix_kwp_status_history_submission
    ON kwp_form_status_history(submission_id, changed_at, id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX ix_kwp_status_history_submission ON kwp_form_status_history;');
  await knex.raw('DROP INDEX ix_kwp_forms_point_code ON kwp_form_submissions;');
  await knex.raw('DROP INDEX ix_kwp_forms_factory ON kwp_form_submissions;');
  await knex.raw('DROP INDEX ix_kwp_forms_type_status_created ON kwp_form_submissions;');
  await knex.raw('ALTER TABLE kwp_form_status_history DROP CONSTRAINT ck_kwp_status_history_status;');
  await knex.raw('ALTER TABLE kwp_form_submissions DROP CONSTRAINT ck_kwp_form_status;');
  await knex.raw('ALTER TABLE kwp_form_submissions DROP CONSTRAINT ck_kwp_form_type;');
  await knex.schema.dropTableIfExists('kwp_form_status_history');
  await knex.schema.dropTableIfExists('kwp_form_submissions');
}
