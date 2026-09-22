import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TRIGGER trg_cems_wpms_point_code_registry_immutable
    ON cems_wpms_point_code_registry
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (SELECT 1 FROM inserted)
        THROW 51095, 'Point-code registry rows cannot be updated.', 1;

      IF EXISTS (
        SELECT 1
        FROM deleted AS reservation
        LEFT JOIN cems_wpms_measurement_points AS source WITH (UPDLOCK, HOLDLOCK)
          ON source.id = reservation.source_measurement_point_id
          AND source.request_id = reservation.source_request_id
        WHERE source.id IS NULL
          OR source.deleted_at IS NULL
          OR EXISTS (
            SELECT 1
            FROM cems_wpms_connected_measurement_points AS connected WITH (UPDLOCK, HOLDLOCK)
            WHERE connected.source_measurement_point_id = source.id
              OR UPPER(LTRIM(RTRIM(connected.point_code))) = reservation.normalized_point_code
              OR (
                connected.deleted_at IS NULL
                AND UPPER(LTRIM(RTRIM(connected.point_name))) = reservation.normalized_point_code
              )
          )
          OR EXISTS (
            SELECT 1
            FROM cems_wpms_measurement_points AS other_point WITH (UPDLOCK, HOLDLOCK)
            WHERE other_point.deleted_at IS NULL
              AND UPPER(LTRIM(RTRIM(other_point.point_code))) = reservation.normalized_point_code
          )
          OR EXISTS (
            SELECT 1
            FROM device_connection_configs AS config WITH (UPDLOCK, HOLDLOCK)
            WHERE config.request_id IS NULL
              AND config.deleted_at IS NULL
              AND UPPER(LTRIM(RTRIM(config.station_id))) = reservation.normalized_point_code
          )
      )
        THROW 51096, 'Only retired, unconnected point-code reservations can be deleted.', 1;

      DELETE registry
      FROM cems_wpms_point_code_registry AS registry
      INNER JOIN deleted AS reservation ON reservation.id = registry.id;
    END;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Previously released reservations cannot be reconstructed by a schema rollback.
  await knex.schema.raw(`
    ALTER TRIGGER trg_cems_wpms_point_code_registry_immutable
    ON cems_wpms_point_code_registry
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51095, 'Point-code registry rows are immutable and cannot be updated or deleted.', 1;
    END;
  `);
}
