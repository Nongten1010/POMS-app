import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('factory_monitoring_point_forms', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('factory_name', 'NVARCHAR(500) NOT NULL');
    table.specificType('factory_registration_no_new', 'NVARCHAR(64) NOT NULL');
    table.specificType('factory_registration_no_old', 'NVARCHAR(64) NULL');
    table.specificType('province_name', 'NVARCHAR(128) NULL');
    table.specificType('factory_type_main', 'NVARCHAR(128) NULL');
    table.specificType('factory_type_sub', 'NVARCHAR(128) NULL');
    table.specificType('operation_status', 'NVARCHAR(128) NULL');
    table.specificType('eia_info', 'NVARCHAR(255) NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('business_activity', 'NVARCHAR(4000) NULL');
    addAuditColumns(table);
  });

  await knex.schema.createTable('factory_monitoring_points', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('form_id').notNullable();
    table.specificType('system_type', 'VARCHAR(8) NOT NULL');
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('point_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('production_unit_type', 'NVARCHAR(255) NULL');
    table.specificType('production_capacity', 'NVARCHAR(255) NULL');
    table.specificType('cems_installation_required_by', 'NVARCHAR(255) NULL');
    table.specificType('cems_installation_required_other', 'NVARCHAR(255) NULL');
    table.specificType('legal_annex_no', 'NVARCHAR(255) NULL');
    table.specificType('accounting_connection_status', 'NVARCHAR(255) NULL');
    table.specificType('eligible_parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('exempted_parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('connected_parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('pending_parameters_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('primary_fuel', 'NVARCHAR(255) NULL');
    table.specificType('secondary_fuel', 'NVARCHAR(255) NULL');
    table.specificType('details_json', 'NVARCHAR(MAX) NULL');
    addAuditColumns(table);
    table
      .foreign('form_id', 'fk_factory_monitoring_points_form')
      .references('id')
      .inTable('factory_monitoring_point_forms');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_factory_monitoring_forms_registration
    ON factory_monitoring_point_forms(factory_registration_no_new)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_factory_monitoring_points_form
    ON factory_monitoring_points(form_id, id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_points
    ADD CONSTRAINT ck_factory_monitoring_points_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('factory_monitoring_points');
  await knex.schema.dropTableIfExists('factory_monitoring_point_forms');
}
