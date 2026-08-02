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
  async findConnectedPointByStationId(
    stationId: string,
  ): Promise<IntegrationConnectedPointDTO | null> {
    const row = await db<ConnectedMeasurementPointRow>('cems_wpms_connected_measurement_points')
      .whereNull('deleted_at')
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
