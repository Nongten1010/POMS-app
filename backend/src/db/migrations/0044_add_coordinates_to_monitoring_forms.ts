import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('factory_monitoring_point_forms', (table) => {
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
  });

  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ADD CONSTRAINT ck_factory_monitoring_forms_latitude
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    ADD CONSTRAINT ck_factory_monitoring_forms_longitude
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    DROP CONSTRAINT ck_factory_monitoring_forms_longitude;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_forms
    DROP CONSTRAINT ck_factory_monitoring_forms_latitude;
  `);

  await knex.schema.alterTable('factory_monitoring_point_forms', (table) => {
    table.dropColumn('longitude');
    table.dropColumn('latitude');
  });
}
