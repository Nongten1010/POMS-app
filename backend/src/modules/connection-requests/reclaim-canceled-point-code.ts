import type { Knex } from 'knex';
import { ConflictError } from '../../shared/errors/AppError';

/** Call before assigning a code, while the destination request is locked. */
export async function reclaimCanceledPointCode(
  trx: Knex.Transaction,
  pointCode: string,
  requestId: number,
  errorPath = 'measurementPoints.0.pointCode',
): Promise<void> {
  // Delete and replacement INSERT share the caller's transaction. Keep the old
  // request and point as history; the unique registry index arbitrates new owners.
  try {
    await trx.raw(
      `/* reclaim-canceled-point-code */
    DELETE FROM cems_wpms_point_code_registry WITH (UPDLOCK, HOLDLOCK)
    WHERE normalized_point_code = ?
      AND EXISTS (
        SELECT 1
        FROM cems_wpms_connection_requests AS old_request WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN cems_wpms_measurement_points AS source WITH (UPDLOCK, HOLDLOCK)
          ON source.request_id = old_request.id
          AND source.id = cems_wpms_point_code_registry.source_measurement_point_id
        INNER JOIN cems_wpms_connection_requests AS new_request WITH (UPDLOCK, HOLDLOCK)
          ON new_request.id = ?
        WHERE old_request.id = cems_wpms_point_code_registry.source_request_id
          AND old_request.id <> new_request.id
          AND old_request.status = 'CANCELED'
          AND old_request.deleted_at IS NULL
          AND new_request.deleted_at IS NULL
          AND old_request.system_type = new_request.system_type
          AND (
            (old_request.eligible_factory_id IS NOT NULL
              AND new_request.eligible_factory_id = old_request.eligible_factory_id)
            OR ((old_request.eligible_factory_id IS NULL OR new_request.eligible_factory_id IS NULL)
              AND old_request.factory_id = new_request.factory_id
              AND LTRIM(RTRIM(old_request.factory_id)) <> '')
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM cems_wpms_connected_measurement_points AS connected WITH (UPDLOCK, HOLDLOCK)
        WHERE connected.source_measurement_point_id = cems_wpms_point_code_registry.source_measurement_point_id
          OR UPPER(LTRIM(RTRIM(connected.point_code))) = cems_wpms_point_code_registry.normalized_point_code
          OR (connected.deleted_at IS NULL
            AND UPPER(LTRIM(RTRIM(connected.point_name))) = cems_wpms_point_code_registry.normalized_point_code)
      )
      AND NOT EXISTS (
        SELECT 1 FROM cems_wpms_measurement_points AS other_point WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN cems_wpms_connection_requests AS other_request WITH (UPDLOCK, HOLDLOCK)
          ON other_request.id = other_point.request_id
        WHERE other_point.deleted_at IS NULL
          AND other_point.id <> cems_wpms_point_code_registry.source_measurement_point_id
          AND UPPER(LTRIM(RTRIM(other_point.point_code))) = cems_wpms_point_code_registry.normalized_point_code
          AND (other_request.status IS NULL OR other_request.status <> 'CANCELED')
      )
      AND NOT EXISTS (
        SELECT 1 FROM device_connection_configs AS live_config WITH (UPDLOCK, HOLDLOCK)
        WHERE live_config.request_id IS NULL AND live_config.deleted_at IS NULL
          AND UPPER(LTRIM(RTRIM(live_config.station_id))) = cems_wpms_point_code_registry.normalized_point_code
      )`,
      [pointCode.trim().toUpperCase(), requestId],
    );
  } catch (error) {
    const candidate = error as {
      number?: number;
      originalError?: { info?: { number?: number } };
    } | null;
    if (Number(candidate?.number ?? candidate?.originalError?.info?.number) !== 51096) throw error;
    throw new ConflictError('Measurement point code is already assigned', {
      path: errorPath,
      reason: 'POINT_CODE_ALREADY_ASSIGNED',
      pointCode,
    });
  }
}
