import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('eligible_factories', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('source_system', 'VARCHAR(64) NOT NULL DEFAULT \'external_factory_db\'');
    table.specificType('source_factory_id', 'VARCHAR(64) NULL');
    table.specificType('factory_registration_no_new', 'NVARCHAR(64) NOT NULL');
    table.specificType('factory_registration_no_old', 'NVARCHAR(64) NULL');
    table.string('factory_name', 500).notNullable();
    table.specificType('factory_type_sequence', 'NVARCHAR(128) NULL');
    table.specificType('address', 'NVARCHAR(1000) NULL');
    table.specificType('province_name', 'NVARCHAR(128) NOT NULL');
    table.specificType('industrial_estate_name', 'NVARCHAR(255) NULL');
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
    table.specificType('business_activity', 'NVARCHAR(MAX) NULL');
    table.specificType('operation_status', 'NVARCHAR(64) NOT NULL');
    table.decimal('capital_amount', 18, 2).nullable();
    table.decimal('machinery_horsepower', 18, 2).nullable();
    table.specificType('production_capacity', 'NVARCHAR(500) NULL');
    table.specificType('wastewater_discharge_info', 'NVARCHAR(MAX) NULL');
    table.integer('boiler_count').nullable();
    table.specificType('boiler_size_each', 'NVARCHAR(500) NULL');
    table.specificType('fuel_used', 'NVARCHAR(500) NULL');
    table.boolean('has_eia').nullable();
    table.specificType('selected_reason', 'NVARCHAR(1000) NULL');
    table.bigInteger('selected_by').notNullable();
    table.specificType('selected_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    addAuditColumns(table);
    table.unique(['factory_registration_no_new'], {
      indexName: 'uq_eligible_factory_registration_new',
    });
    table.foreign('selected_by', 'fk_eligible_factory_selected_by').references('id').inTable('users');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_eligible_factories_province
    ON eligible_factories(province_name)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_eligible_factories_selected_at
    ON eligible_factories(selected_at DESC)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE eligible_factories
    ADD CONSTRAINT ck_eligible_factories_latitude
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  `);
  await knex.schema.raw(`
    ALTER TABLE eligible_factories
    ADD CONSTRAINT ck_eligible_factories_longitude
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  `);
  await knex.schema.raw(`
    ALTER TABLE eligible_factories
    ADD CONSTRAINT ck_eligible_factories_boiler_count
    CHECK (boiler_count IS NULL OR boiler_count >= 0);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('eligible_factories');
}
