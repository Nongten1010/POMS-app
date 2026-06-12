import { db } from '../../config/database';
import type { IntegrationConnectedPointDTO } from './integration-device-configs.types';
import type { MeasurementInstrumentsInput } from '../connection-requests/connection-requests.types';

interface ConnectedMeasurementPointRow {
  point_name: string;
  point_code: string | null;
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
      .first('point_name', 'point_code', 'instruments_json');

    if (!row) return null;

    return {
      stationId: row.point_code ?? row.point_name,
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
