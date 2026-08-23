import type { Knex } from 'knex';

const TABLE_NAME = 'device_measurement_channels';
const COLUMN_NAME = 'test_mode';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (hasColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.boolean(COLUMN_NAME).notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (!hasColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn(COLUMN_NAME);
  });
}
