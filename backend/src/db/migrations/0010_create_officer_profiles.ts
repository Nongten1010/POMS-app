import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('officer_profiles', (table) => {
    table.bigInteger('user_id').notNullable().primary();
    table.specificType('pos_no', 'VARCHAR(16) NULL');
    table.specificType('pertype_id', 'VARCHAR(8) NULL');
    table.string('pertype', 128).nullable();
    table.specificType('position_type_id', 'VARCHAR(8) NULL');
    table.string('position_type_th', 64).nullable();
    table.specificType('line_id', 'VARCHAR(8) NULL');
    table.string('line_name_th', 128).nullable();
    table.specificType('level_id', 'VARCHAR(8) NULL');
    table.string('level_name_th', 64).nullable();
    table.specificType('mposition_id', 'VARCHAR(8) NULL');
    table.string('mposition', 128).nullable();
    table.specificType('organize_id', 'VARCHAR(16) NULL');
    table.specificType('division_id', 'VARCHAR(16) NULL');
    table.specificType('department_id', 'VARCHAR(16) NULL');
    table.specificType('ministry_id', 'VARCHAR(8) NULL');
    table.specificType('province_id', 'VARCHAR(8) NULL');
    table.specificType('per_status', 'VARCHAR(8) NULL');
    table.string('per_status_name', 64).nullable();
    table.specificType('relocation_type', 'VARCHAR(8) NULL');
    table.string('relocation_name', 128).nullable();
    table.specificType('synced_at', 'DATETIME2 NULL');
    table
      .foreign('user_id', 'fk_officer_user')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });

  await knex.schema.raw(`CREATE INDEX ix_officer_division ON officer_profiles(division_id);`);
  await knex.schema.raw(`CREATE INDEX ix_officer_province ON officer_profiles(province_id);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('officer_profiles');
}
