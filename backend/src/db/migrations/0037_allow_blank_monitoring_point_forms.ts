import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX uq_factory_monitoring_forms_registration
    ON factory_monitoring_point_forms;
  `);

  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ALTER COLUMN factory_name NVARCHAR(500) NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ALTER COLUMN factory_registration_no_new NVARCHAR(64) NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_points
    ALTER COLUMN point_name NVARCHAR(255) NULL;
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_factory_monitoring_forms_registration
    ON factory_monitoring_point_forms(factory_registration_no_new)
    WHERE deleted_at IS NULL AND factory_registration_no_new IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX uq_factory_monitoring_forms_registration
    ON factory_monitoring_point_forms;
  `);

  await knex.schema.raw(`
    UPDATE factory_monitoring_point_forms
    SET factory_name = N'-'
    WHERE factory_name IS NULL;
  `);
  await knex.schema.raw(`
    UPDATE factory_monitoring_point_forms
    SET factory_registration_no_new = CONCAT(N'BLANK-', id)
    WHERE factory_registration_no_new IS NULL;
  `);
  await knex.schema.raw(`
    UPDATE factory_monitoring_points
    SET point_name = N'-'
    WHERE point_name IS NULL;
  `);

  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ALTER COLUMN factory_name NVARCHAR(500) NOT NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ALTER COLUMN factory_registration_no_new NVARCHAR(64) NOT NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_points
    ALTER COLUMN point_name NVARCHAR(255) NOT NULL;
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_factory_monitoring_forms_registration
    ON factory_monitoring_point_forms(factory_registration_no_new)
    WHERE deleted_at IS NULL;
  `);
}
