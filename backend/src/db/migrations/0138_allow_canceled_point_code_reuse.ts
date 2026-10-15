import type { Knex } from 'knex';
import { up as restoreRetiredOnlyTrigger } from './0126_allow_unconnected_point_code_release';

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
        SELECT 1 FROM deleted AS reservation
        LEFT JOIN cems_wpms_measurement_points AS source WITH (UPDLOCK, HOLDLOCK)
          ON source.id = reservation.source_measurement_point_id
          AND source.request_id = reservation.source_request_id
        LEFT JOIN cems_wpms_connection_requests AS source_request WITH (UPDLOCK, HOLDLOCK)
          ON source_request.id = source.request_id
        WHERE source.id IS NULL
          OR (source.deleted_at IS NULL
            AND (source_request.status IS NULL OR source_request.status <> 'CANCELED'))
          OR EXISTS (
            SELECT 1 FROM cems_wpms_connected_measurement_points AS connected WITH (UPDLOCK, HOLDLOCK)
            WHERE connected.source_measurement_point_id = source.id
              OR UPPER(LTRIM(RTRIM(connected.point_code))) = reservation.normalized_point_code
              OR (connected.deleted_at IS NULL
                AND UPPER(LTRIM(RTRIM(connected.point_name))) = reservation.normalized_point_code)
          )
          OR EXISTS (
            SELECT 1 FROM cems_wpms_measurement_points AS other_point WITH (UPDLOCK, HOLDLOCK)
            LEFT JOIN cems_wpms_connection_requests AS other_request WITH (UPDLOCK, HOLDLOCK)
              ON other_request.id = other_point.request_id
            WHERE other_point.deleted_at IS NULL
              AND other_point.id <> source.id
              AND UPPER(LTRIM(RTRIM(other_point.point_code))) = reservation.normalized_point_code
              AND (other_request.status IS NULL OR other_request.status <> 'CANCELED')
          )
          OR EXISTS (
            SELECT 1 FROM device_connection_configs AS live_config WITH (UPDLOCK, HOLDLOCK)
            WHERE live_config.request_id IS NULL AND live_config.deleted_at IS NULL
              AND UPPER(LTRIM(RTRIM(live_config.station_id))) = reservation.normalized_point_code
          )
      )
        THROW 51096, 'Only retired or canceled, unconnected point-code reservations can be deleted.', 1;

      DELETE registry FROM cems_wpms_point_code_registry AS registry
      INNER JOIN deleted AS reservation ON reservation.id = registry.id;
    END;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Reused reservations remain assigned to their new owners.
  await restoreRetiredOnlyTrigger(knex);
}
