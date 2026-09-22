import type { Knex } from 'knex';
import { ConflictError } from '../../shared/errors/AppError';

interface PointCodeReservation {
  id: number | string;
  normalized_point_code: string;
  source_request_id: number | string | null;
  source_measurement_point_id: number | string | null;
}

/** The caller must lock the request and check edit access before removing its points. */
export async function removeUnconnectedRequestPoints(
  trx: Knex.Transaction,
  requestId: number,
  retainedPointIds: number[] = [],
): Promise<void> {
  const points = await trx('cems_wpms_measurement_points')
    .where('request_id', requestId)
    .forUpdate()
    .select('id');
  const allPointIds = points.map((point) => Number(point.id));
  if (allPointIds.length === 0) return;

  // Even a retired connected row still refers to the source point by foreign key.
  const connectedReference = await trx('cems_wpms_connected_measurement_points')
    .whereIn('source_measurement_point_id', allPointIds)
    .first('id');
  if (connectedReference) {
    throw new ConflictError('Connected measurement points cannot be removed by resubmission', {
      path: 'measurementPoints',
      reason: 'REQUEST_POINTS_ALREADY_CONNECTED',
      requestId,
    });
  }

  const retained = new Set(retainedPointIds);
  const pointIds = allPointIds.filter((id) => !retained.has(id));
  if (pointIds.length === 0) return;

  const reservations = await trx<PointCodeReservation>('cems_wpms_point_code_registry')
    .whereIn('source_measurement_point_id', pointIds)
    .forUpdate()
    .select('id', 'normalized_point_code', 'source_request_id', 'source_measurement_point_id');
  const releaseBlocked = (pointCode?: string) =>
    new ConflictError('Measurement point code is still referenced and cannot be released', {
      path: 'measurementPoints',
      reason: 'POINT_CODE_RELEASE_BLOCKED',
      requestId,
      ...(pointCode ? { pointCode } : {}),
    });

  for (const reservation of reservations) {
    const pointCode = reservation.normalized_point_code;
    if (Number(reservation.source_request_id) !== requestId) throw releaseBlocked(pointCode);

    const connectedCode = await trx('cems_wpms_connected_measurement_points')
      .whereRaw('UPPER(LTRIM(RTRIM(point_code))) = ?', [pointCode])
      .first('id');
    const connectedAlias = await trx('cems_wpms_connected_measurement_points')
      .whereNull('deleted_at')
      .whereRaw('UPPER(LTRIM(RTRIM(point_name))) = ?', [pointCode])
      .first('id');
    const otherPoint = await trx('cems_wpms_measurement_points')
      .whereNull('deleted_at')
      .whereNotIn('id', pointIds)
      .whereRaw('UPPER(LTRIM(RTRIM(point_code))) = ?', [pointCode])
      .first('id');
    const liveDeviceConfig = await trx('device_connection_configs')
      .whereNull('request_id')
      .whereNull('deleted_at')
      .whereRaw('UPPER(LTRIM(RTRIM(station_id))) = ?', [pointCode])
      .first('id');
    if (connectedCode || connectedAlias || otherPoint || liveDeviceConfig) {
      throw releaseBlocked(pointCode);
    }
  }

  // The guarded registry trigger only releases retired, unconnected sources.
  // This intermediate state and both deletes commit together; no point history remains.
  await trx('cems_wpms_measurement_points')
    .whereIn('id', pointIds)
    .update({ deleted_at: trx.fn.now() });
  if (reservations.length > 0) {
    try {
      await trx('cems_wpms_point_code_registry')
        .whereIn(
          'id',
          reservations.map((reservation) => Number(reservation.id)),
        )
        .del();
    } catch (error) {
      const candidate = error as {
        number?: number;
        originalError?: { info?: { number?: number } };
      } | null;
      if (Number(candidate?.number ?? candidate?.originalError?.info?.number) === 51096) {
        throw releaseBlocked();
      }
      throw error;
    }
  }
  await trx('cems_wpms_measurement_points').whereIn('id', pointIds).del();
}
