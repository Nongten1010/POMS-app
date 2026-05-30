import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
  });

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ck_cems_wpms_requests_factory_latitude
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ck_cems_wpms_requests_factory_longitude
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    DROP CONSTRAINT ck_cems_wpms_requests_factory_longitude;
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    DROP CONSTRAINT ck_cems_wpms_requests_factory_latitude;
  `);

  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.dropColumn('longitude');
    table.dropColumn('latitude');
  });
}
