import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('factories', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('fid', 'VARCHAR(20) NOT NULL');
    table.specificType('code', 'NVARCHAR(50) NOT NULL'); // อาจมี Thai เช่น "3-106-33/50สบ"
    table.string('name', 500).notNullable();
    table.bigInteger('juristic_id').notNullable();
    table.specificType('province_id', 'VARCHAR(8) NOT NULL');
    table.bigInteger('industrial_estate_id').nullable();
    table.integer('system_id').nullable();
    table.string('system_detail', 500).nullable();
    table.specificType('verify_status', 'TINYINT NOT NULL DEFAULT 0');
    table.date('authorize_start').nullable();
    table.date('authorize_end').nullable();
    table.date('juristic_start').nullable();
    table.date('verify_date').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    addAuditColumns(table);
    table.unique(['fid'], { indexName: 'uq_factory_fid' });
    table.foreign('juristic_id', 'fk_factory_juristic').references('id').inTable('juristics');
    table.foreign('province_id', 'fk_factory_province').references('id').inTable('provinces');
    table
      .foreign('industrial_estate_id', 'fk_factory_estate')
      .references('id')
      .inTable('industrial_estates');
  });

  await knex.schema.raw(`
    CREATE INDEX ix_factory_province ON factories(province_id) WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_factory_estate ON factories(industrial_estate_id) WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_factory_juristic ON factories(juristic_id) WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('factories');
}
