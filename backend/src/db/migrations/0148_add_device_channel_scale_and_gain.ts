import type { Knex } from 'knex';

const TABLE = 'device_measurement_channels';
const COLUMNS = ['scale_min', 'scale_max', 'gain'] as const;

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  for (const column of COLUMNS) {
    if (!(await knex.schema.hasColumn(TABLE, column))) {
      await knex.schema.alterTable(TABLE, (table) => {
        table.decimal(column, 18, 6).nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const existing: string[] = [];
  for (const column of COLUMNS) {
    if (await knex.schema.hasColumn(TABLE, column)) existing.push(column);
  }
  if (existing.length === 0) return;

  // Include historical/soft-deleted channels and zero values in the data-loss guard.
  const configuredChannel = await knex(TABLE)
    .where((query) => {
      for (const column of existing) query.orWhereNotNull(column);
    })
    .first('id');
  if (configuredChannel) {
    throw new Error('Cannot remove Scale/Gain columns while configured channel values exist.');
  }

  await knex.schema.alterTable(TABLE, (table) => {
    table.dropColumns(...existing);
  });
}
