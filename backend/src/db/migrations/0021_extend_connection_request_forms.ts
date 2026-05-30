import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.specificType(
      'request_type',
      "VARCHAR(32) NOT NULL CONSTRAINT df_cems_wpms_requests_request_type DEFAULT 'NEW_CONNECTION'",
    );
  });

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ck_cems_wpms_requests_request_type
    CHECK (request_type IN ('NEW_CONNECTION', 'ADD_MEASUREMENT_POINT', 'ADD_PARAMETER'));
  `);

  await knex.schema.alterTable('device_connection_configs', (table) => {
    table.bigInteger('request_id').nullable();
    table.specificType('status_management_json', 'NVARCHAR(MAX) NULL');
    table
      .foreign('request_id', 'fk_device_connection_config_request')
      .references('id')
      .inTable('cems_wpms_connection_requests');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_device_connection_configs_request
    ON device_connection_configs(request_id)
    WHERE request_id IS NOT NULL AND deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX ix_device_connection_configs_request
    ON device_connection_configs;
  `);

  await knex.schema.alterTable('device_connection_configs', (table) => {
    table.dropForeign(['request_id'], 'fk_device_connection_config_request');
    table.dropColumn('status_management_json');
    table.dropColumn('request_id');
  });

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    DROP CONSTRAINT ck_cems_wpms_requests_request_type;
  `);
  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    DROP CONSTRAINT df_cems_wpms_requests_request_type;
  `);

  await knex.schema.alterTable('cems_wpms_connection_requests', (table) => {
    table.dropColumn('request_type');
  });
}
