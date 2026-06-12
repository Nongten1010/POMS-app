import { NotFoundError } from '../../shared/errors/AppError';
import { deviceConnectionsService } from '../device-connections/device-connections.service';
import type {
  DeviceConnectionConfigDTO,
  MeasurementRangeInput,
} from '../device-connections/device-connections.types';
import type { MeasurementInstrumentParameterInput } from '../connection-requests/connection-requests.types';
import { integrationDeviceConfigsRepository } from './integration-device-configs.repository';
import type {
  IntegrationConnectedPointDTO,
  IntegrationDeviceConfigDTO,
  IntegrationDeviceConfigsResponseDTO,
  IntegrationParameterConfigDTO,
  IntegrationStatusScheduleDTO,
} from './integration-device-configs.types';

export const integrationDeviceConfigsService = {
  async getByStationId(stationId: string): Promise<IntegrationDeviceConfigsResponseDTO> {
    const point = await integrationDeviceConfigsRepository.findConnectedPointByStationId(stationId);
    if (!point) throw new NotFoundError('Connected measurement point not found');

    const configs = await deviceConnectionsService.listActiveSettings({
      stationId: point.stationId,
    });
    const standards = buildStandardLookup(point);

    return {
      stationId: point.stationId,
      deviceConfigs: configs.map((config, index) => toDeviceConfig(config, point.stationId, index)),
      parameterConfigs: configs.flatMap((config, configIndex) =>
        config.channels.map((channel) =>
          toParameterConfig(
            getDeviceCode(config, point.stationId, configIndex),
            channel,
            standards.get(channel.dataType) ?? null,
          ),
        ),
      ),
      statusSchedules: toStatusSchedules(configs),
    };
  },
};

interface StandardValues {
  standardCriteria: number | string | null;
  eiaCriteria: number | string | null;
}

interface StandardLookup {
  get(parameterName: string): StandardValues | null;
}

function toDeviceConfig(
  config: DeviceConnectionConfigDTO,
  stationId: string,
  index: number,
): IntegrationDeviceConfigDTO {
  const settings = config.settings;
  const range = readRange(settings.valueRange);

  return {
    deviceCode: getDeviceCode(config, stationId, index),
    protocol: config.protocol,
    hostIp: readString(settings.hostIp),
    port: readNumber(settings.port),
    slaveId: readNumber(settings.slaveId),
    comPort: readNumber(settings.comPort),
    baudRate: readNumber(settings.baudRate),
    parity: readString(settings.parity),
    stopBits: readNumber(settings.stopBits),
    dataBits: readNumber(settings.dataBits),
    quantity: readNumber(settings.quantity),
    dbUser: readString(settings.dbUser),
    dbPass: readString(settings.dbPass),
    dbName: readString(settings.dbName),
    deviceValueRangeMin: range?.min ?? null,
    deviceValueRangeMax: range?.max ?? null,
  };
}

function toParameterConfig(
  deviceCode: string,
  channel: DeviceConnectionConfigDTO['channels'][number],
  standard: StandardValues | null,
): IntegrationParameterConfigDTO {
  return {
    deviceCode,
    addressId: channel.addressId,
    parameter: channel.dataType,
    valueRange: channel.valueRange ?? null,
    valueFormat: channel.valueFormat ?? null,
    offset: channel.offset,
    encoding: channel.encoding ?? null,
    standardCriteria: standard?.standardCriteria ?? null,
    eiaCriteria: standard?.eiaCriteria ?? null,
    status: channel.status ?? 'Normal',
  };
}

function toStatusSchedules(configs: DeviceConnectionConfigDTO[]): IntegrationStatusScheduleDTO[] {
  const schedules: IntegrationStatusScheduleDTO[] = [];
  const seen = new Set<string>();

  for (const config of configs) {
    const statusManagement = config.statusManagement;
    if (!statusManagement) continue;

    const entries =
      statusManagement.schedules.length > 0
        ? statusManagement.schedules
        : [
            {
              selectedParameters: statusManagement.selectedParameters,
              startAt: statusManagement.startAt,
              endAt: statusManagement.endAt,
              status: statusManagement.status,
            },
          ];

    for (const entry of entries) {
      for (const parameter of entry.selectedParameters) {
        const schedule = {
          parameter,
          startAt: entry.startAt,
          endAt: entry.endAt,
          status: entry.status,
        };
        const key = `${schedule.parameter}\u0000${schedule.startAt ?? ''}\u0000${
          schedule.endAt ?? ''
        }\u0000${schedule.status}`;
        if (seen.has(key)) continue;
        seen.add(key);
        schedules.push(schedule);
      }
    }
  }

  return schedules;
}

function buildStandardLookup(point: IntegrationConnectedPointDTO): StandardLookup {
  const exact = new Map<string, StandardValues>();
  const looseBuckets = new Map<string, Array<[string, StandardValues]>>();
  const parameters = point.measurementInstruments?.parameters ?? [];

  for (const parameter of parameters) {
    const name = parameter.parameter?.trim();
    if (!name) continue;

    const values = toStandardValues(parameter);
    const exactKey = normalizeParameterKey(name);
    exact.set(exactKey, values);

    const looseKey = normalizeParameterKey(stripTrailingUnit(name));
    const bucket = looseBuckets.get(looseKey) ?? [];
    bucket.push([exactKey, values]);
    looseBuckets.set(looseKey, bucket);
  }

  return {
    get(parameterName: string): StandardValues | null {
      const exactMatch = exact.get(normalizeParameterKey(parameterName));
      if (exactMatch) return exactMatch;

      const looseMatches = looseBuckets.get(
        normalizeParameterKey(stripTrailingUnit(parameterName)),
      );
      if (!looseMatches || looseMatches.length !== 1) return null;
      return looseMatches[0][1];
    },
  };
}

function toStandardValues(parameter: MeasurementInstrumentParameterInput): StandardValues {
  return {
    standardCriteria: readStandardValue(parameter.standardCriteria),
    eiaCriteria: readStandardValue(parameter.eiaCriteria),
  };
}

function readStandardValue(criteria: unknown): number | string | null {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) return null;
  const value = (criteria as { standardValue?: unknown }).standardValue;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function getDeviceCode(
  config: Pick<DeviceConnectionConfigDTO, 'deviceCode'>,
  stationId: string,
  index: number,
): string {
  return config.deviceCode || `${stationId}/${String(index + 1).padStart(2, '0')}`;
}

function readRange(value: unknown): MeasurementRangeInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const range = value as { min?: unknown; max?: unknown };
  if (typeof range.min !== 'number' || typeof range.max !== 'number') return null;
  return { min: range.min, max: range.max };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeParameterKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stripTrailingUnit(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '');
}
