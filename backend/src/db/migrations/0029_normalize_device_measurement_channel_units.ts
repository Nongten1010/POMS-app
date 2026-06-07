import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasUnit = await knex.schema.hasColumn('device_measurement_channels', 'unit');
  if (!hasUnit) return;

  await knex.schema.raw(`
    UPDATE device_measurement_channels
    SET
      data_type = CONCAT(RTRIM(LTRIM(data_type)), N' (', RTRIM(LTRIM(unit)), N')'),
      unit = N''
    WHERE RTRIM(LTRIM(ISNULL(unit, N''))) <> N''
      AND RIGHT(RTRIM(LTRIM(data_type)), 1) <> N')'
      AND data_type NOT LIKE CONCAT(N'%', N'(', RTRIM(LTRIM(unit)), N')');
  `);

  await knex.schema.raw(`
    UPDATE device_measurement_channels
    SET unit = N''
    WHERE RTRIM(LTRIM(ISNULL(unit, N''))) <> N''
      AND RIGHT(RTRIM(LTRIM(data_type)), 1) = N')';
  `);

  await knex.schema.alterTable('device_measurement_channels', (table) => {
    table.dropColumn('unit');
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasUnit = await knex.schema.hasColumn('device_measurement_channels', 'unit');
  if (!hasUnit) {
    await knex.schema.alterTable('device_measurement_channels', (table) => {
      table.specificType('unit', 'NVARCHAR(64) NOT NULL').defaultTo('');
    });
  }
}
