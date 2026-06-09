import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_cems_wpms_points_request_ordered'
        AND object_id = OBJECT_ID('cems_wpms_measurement_points')
    )
    BEGIN
      CREATE INDEX ix_cems_wpms_points_request_ordered
      ON cems_wpms_measurement_points(request_id, id)
      WHERE deleted_at IS NULL;
    END
  `);

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_cems_wpms_status_history_request_ordered'
        AND object_id = OBJECT_ID('cems_wpms_request_status_history')
    )
    BEGIN
      CREATE INDEX ix_cems_wpms_status_history_request_ordered
      ON cems_wpms_request_status_history(request_id, changed_at, id);
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_cems_wpms_status_history_request_ordered'
        AND object_id = OBJECT_ID('cems_wpms_request_status_history')
    )
    BEGIN
      DROP INDEX ix_cems_wpms_status_history_request_ordered
      ON cems_wpms_request_status_history;
    END
  `);

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_cems_wpms_points_request_ordered'
        AND object_id = OBJECT_ID('cems_wpms_measurement_points')
    )
    BEGIN
      DROP INDEX ix_cems_wpms_points_request_ordered
      ON cems_wpms_measurement_points;
    END
  `);
}
