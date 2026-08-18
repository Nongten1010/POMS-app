import type { Knex } from 'knex';

const REQUEST_POINTS_TABLE = 'cems_wpms_measurement_points';
const CONNECTED_POINTS_TABLE = 'cems_wpms_connected_measurement_points';
const STATUS_COLUMN = 'monitoring_point_status';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(REQUEST_POINTS_TABLE, STATUS_COLUMN))) {
    await knex.schema.alterTable(REQUEST_POINTS_TABLE, (table) => {
      table.specificType(STATUS_COLUMN, 'NVARCHAR(64) NULL');
    });
  }

  if (!(await knex.schema.hasColumn(CONNECTED_POINTS_TABLE, STATUS_COLUMN))) {
    await knex.schema.alterTable(CONNECTED_POINTS_TABLE, (table) => {
      table.specificType(STATUS_COLUMN, 'NVARCHAR(64) NULL');
    });
  }

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_connected_points_monitoring_status'
        AND object_id = OBJECT_ID('${CONNECTED_POINTS_TABLE}')
    )
    BEGIN
      CREATE INDEX ix_connected_points_monitoring_status
      ON ${CONNECTED_POINTS_TABLE}(${STATUS_COLUMN})
      WHERE deleted_at IS NULL AND ${STATUS_COLUMN} IS NOT NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_connected_points_monitoring_status'
        AND object_id = OBJECT_ID('${CONNECTED_POINTS_TABLE}')
    )
    BEGIN
      DROP INDEX ix_connected_points_monitoring_status ON ${CONNECTED_POINTS_TABLE};
    END
  `);

  if (await knex.schema.hasColumn(CONNECTED_POINTS_TABLE, STATUS_COLUMN)) {
    await knex.schema.alterTable(CONNECTED_POINTS_TABLE, (table) => {
      table.dropColumn(STATUS_COLUMN);
    });
  }

  if (await knex.schema.hasColumn(REQUEST_POINTS_TABLE, STATUS_COLUMN)) {
    await knex.schema.alterTable(REQUEST_POINTS_TABLE, (table) => {
      table.dropColumn(STATUS_COLUMN);
    });
  }
}
