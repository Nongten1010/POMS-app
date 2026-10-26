import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';
import { db } from '../../config/database';
import type { IntegrationConnectedPointDTO } from './integration-device-configs.types';
import type {
  ConnectionSystemType,
  MeasurementInstrumentsInput,
  MeasurementPointType,
} from '../connection-requests/connection-requests.types';

interface ConnectedMeasurementPointRow {
  point_name: string;
  point_code: string | null;
  system_type: ConnectionSystemType;
  point_type: MeasurementPointType;
  details_json: string | null;
  instruments_json: string | null;
}

export const integrationDeviceConfigsRepository = {
  async findPointByStationId(stationId: string): Promise<IntegrationConnectedPointDTO | null> {
    const source = factoryProfileReadTable('cems_wpms_connected_measurement_points');
    const connected = await db<ConnectedMeasurementPointRow>(source)
      .whereNull('deleted_at')
      .whereNotExists(function canceledOrDeletedOrigin() {
        this.select(db.raw('1'))
          .from('cems_wpms_connection_requests as origin')
          .whereRaw('?? = ??', ['origin.id', `${source}.source_request_id`])
          .where((builder) => {
            builder.where('origin.status', 'CANCELED').orWhereNotNull('origin.deleted_at');
          });
      })
      .where((builder) => {
        builder.where('point_code', stationId).orWhere('point_name', stationId);
      })
      .first(
        'point_name',
        'point_code',
        'system_type',
        'point_type',
        'details_json',
        'instruments_json',
      );

    // A saved request config is needed by workers before an officer verifies connection.
    const row =
      connected ??
      (await db('cems_wpms_measurement_points as mp')
        .join('cems_wpms_connection_requests as r', 'r.id', 'mp.request_id')
        .whereNull('mp.deleted_at')
        .whereNull('r.deleted_at')
        .whereNot('r.status', 'CANCELED')
        .where((builder) => {
          builder.where('mp.point_code', stationId).orWhere('mp.point_name', stationId);
        })
        .orderBy('r.updated_at', 'desc')
        .orderBy('r.id', 'desc')
        .orderBy('mp.id', 'desc')
        .first<ConnectedMeasurementPointRow>(
          'mp.point_name',
          'mp.point_code',
          'r.system_type',
          'mp.point_type',
          'mp.details_json',
          'mp.instruments_json',
        ));

    if (!row) return null;

    const details = parseJsonObject<Record<string, unknown>>(row.details_json);

    return {
      stationId: row.point_code ?? row.point_name,
      systemType: row.system_type,
      pointType: row.point_type,
      monitoringPointKind:
        typeof details?.monitoringPointKind === 'string' ? details.monitoringPointKind : null,
      measurementInstruments: parseJsonObject<MeasurementInstrumentsInput>(row.instruments_json),
    };
  },
};

function parseJsonObject<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    return null;
  }
  return null;
}
