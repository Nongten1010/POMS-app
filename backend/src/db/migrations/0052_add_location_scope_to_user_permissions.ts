import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_permissions', (table) => {
    table.specificType('region_name', 'NVARCHAR(128) NULL');
    table.specificType('province_id', 'VARCHAR(8) NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE user_permissions
    ADD CONSTRAINT fk_user_permissions_province
    FOREIGN KEY (province_id) REFERENCES provinces(id);
  `);

  await knex.schema.raw(`
    CREATE INDEX ix_user_permissions_location
    ON user_permissions(scope, region_name, province_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX ix_user_permissions_location ON user_permissions;
  `);

  await knex.schema.alterTable('user_permissions', (table) => {
    table.dropForeign(['province_id'], 'fk_user_permissions_province');
    table.dropColumn('province_id');
    table.dropColumn('region_name');
  });
}
