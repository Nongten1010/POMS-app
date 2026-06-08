import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('user_factory_favorites');
  if (!exists) {
    await knex.schema.createTable('user_factory_favorites', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').notNullable();
      table.specificType('factory_id', 'VARCHAR(64) NOT NULL');
      addAuditColumns(table);
      table.foreign('user_id', 'fk_user_factory_favorites_user').references('id').inTable('users');
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_user_factory_favorites_active'
        AND object_id = OBJECT_ID('user_factory_favorites')
    )
    BEGIN
      CREATE UNIQUE INDEX uq_user_factory_favorites_active
      ON user_factory_favorites(user_id, factory_id)
      WHERE deleted_at IS NULL;
    END
  `);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_user_factory_favorites_user'
        AND object_id = OBJECT_ID('user_factory_favorites')
    )
    BEGIN
      CREATE INDEX ix_user_factory_favorites_user
      ON user_factory_favorites(user_id)
      WHERE deleted_at IS NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_factory_favorites');
}
