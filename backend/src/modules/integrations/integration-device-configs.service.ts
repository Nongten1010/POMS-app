import { NotFoundError } from '../../shared/errors/AppError';
import { toCanonicalStatusDateTime } from '../device-connections/device-connection-status-datetime';
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
  IntegrationMeasurementPointType,
  IntegrationMonitoringPointKind,
  IntegrationParameterConfigDTO,
  IntegrationStatusScheduleDTO,
} from './integration-device-configs.types';

export const integrationDeviceConfigsService = {
  async getByStationId(stationId: string): Promise<IntegrationDeviceConfigsResponseDTO> {
    const point = await integrationDeviceConfigsRepository.findConnectedPointByStationId(stationId);
    if (!point) throw new NotFoundError('Connected measurement point not found');

    const configs = await deviceConnectionsService.listActiveSettingsForIntegration({
      stationId: point.stationId,
    });
    const parameterMetadata = buildParameterMetadataLookup(point);
    const measurementPointMetadata = toMeasurementPointMetadata(point);

    return {
      stationId: point.stationId,
      // Keep point classification at the response root so every device shares one source of truth.
      ...measurementPointMetadata,
      deviceConfigs: configs.map((config, index) => toDeviceConfig(config, point.stationId, index)),
      parameterConfigs: configs.flatMap((config, configIndex) =>
        config.channels.map((channel) =>
          toParameterConfig(
            getDeviceCode(config, point.stationId, configIndex),
            channel,
            parameterMetadata.get(channel.dataType) ?? null,
          ),
        ),
      ),
      statusSchedules: toStatusSchedules(configs),
    };
  },
};

interface IntegrationMeasurementPointMetadata {
  measurementPointType: IntegrationMeasurementPointType;
  systemType: IntegrationConnectedPointDTO['systemType'];
  pointType: IntegrationConnectedPointDTO['pointType'];
  monitoringPointKind: IntegrationMonitoringPointKind | null;
}

function toMeasurementPointMetadata(
  point: IntegrationConnectedPointDTO,
): IntegrationMeasurementPointMetadata {
  const normalizedKind = normalizeMonitoringPointKind(point.monitoringPointKind);
  const hasUnknownKind =
    typeof point.monitoringPointKind === 'string' &&
    point.monitoringPointKind.trim().length > 0 &&
    normalizedKind === null;

  return {
    measurementPointType: hasUnknownKind
      ? 'UNKNOWN'
      : deriveMeasurementPointType(point.systemType, point.pointType, normalizedKind),
    systemType: point.systemType,
    pointType: point.pointType,
    monitoringPointKind: normalizedKind,
  };
}

function normalizeMonitoringPointKind(value: unknown): IntegrationMonitoringPointKind | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'CEMS' ||
    normalized === 'WPMS' ||
    normalized === 'MOBILE' ||
    normalized === 'STATION'
  ) {
    return normalized;
  }
  return null;
}

function deriveMeasurementPointType(
  systemType: IntegrationConnectedPointDTO['systemType'],
  pointType: IntegrationConnectedPointDTO['pointType'],
  monitoringPointKind: IntegrationMonitoringPointKind | null,
): IntegrationMeasurementPointType {
  if (
    pointType === 'OTHER' &&
    (monitoringPointKind === 'MOBILE' || monitoringPointKind === 'STATION')
  ) {
    return monitoringPointKind;
  }

  if (
    systemType === 'CEMS' &&
    pointType === 'STACK' &&
    (monitoringPointKind === null || monitoringPointKind === 'CEMS')
  ) {
    return 'CEMS';
  }

  if (
    systemType === 'WPMS' &&
    pointType === 'WASTEWATER' &&
    (monitoringPointKind === null || monitoringPointKind === 'WPMS')
  ) {
    return 'WPMS';
  }

  return 'UNKNOWN';
}

interface ParameterMetadata {
  standardCriteria: number | string | null;
  eiaCriteria: number | string | null;
  standardCondition: boolean | null;
  dryBasis: boolean | null;
  oxygenOrExcessAir: boolean | null;
}

interface ParameterMetadataLookup {
  get(parameterName: string): ParameterMetadata | null;
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
    minuteTableName: readString(settings.minuteTableName),
    fiveMinuteTableName: readString(settings.fiveMinuteTableName),
    hourlyTableName: readString(settings.hourlyTableName),
    deviceValueRangeMin: range?.min ?? null,
    deviceValueRangeMax: range?.max ?? null,
  };
}

function toParameterConfig(
  deviceCode: string,
  channel: DeviceConnectionConfigDTO['channels'][number],
  metadata: ParameterMetadata | null,
): IntegrationParameterConfigDTO {
  const parameterParts = splitParameterAndUnit(channel.dataType);
  return {
    deviceCode,
    addressId: channel.addressId,
    parameter: channel.dataType,
    parameterName: parameterParts.name,
    parameterUnit: parameterParts.unit,
    valueRange: channel.valueRange ?? null,
    alertLow: channel.alertLow ?? null,
    alertHigh: channel.alertHigh ?? null,
    testMode: channel.testMode ?? false,
    valueFormat: channel.valueFormat ?? null,
    offset: channel.offset,
    encoding: channel.encoding ?? null,
    standardCriteria: metadata?.standardCriteria ?? null,
    eiaCriteria: metadata?.eiaCriteria ?? null,
    standardCondition: metadata?.standardCondition ?? null,
    dryBasis: metadata?.dryBasis ?? null,
    oxygenOrExcessAir: metadata?.oxygenOrExcessAir ?? null,
    status: channel.status ?? 'Normal',
  };
}

function toStatusSchedules(configs: DeviceConnectionConfigDTO[]): IntegrationStatusScheduleDTO[] {
  const schedules: IntegrationStatusScheduleDTO[] = [];
  const seen = new Set<string>();
  const configuredParameters = [
    ...new Set(configs.flatMap((config) => config.channels.map((channel) => channel.dataType))),
  ];

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
      const targetParameters = entry.selectedParameters.includes('ทั้งหมด')
        ? configuredParameters
        : entry.selectedParameters;

      for (const parameter of targetParameters) {
        const schedule = {
          parameter,
          startAt: toCanonicalStatusDateTime(entry.startAt),
          endAt: toCanonicalStatusDateTime(entry.endAt),
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

  return [...schedules].sort((left, right) => {
    const startComparison = compareScheduleTime(left.startAt, right.startAt);
    if (startComparison !== 0) return startComparison;

    const parameterComparison = left.parameter.localeCompare(right.parameter);
    if (parameterComparison !== 0) return parameterComparison;

    const endComparison = compareScheduleTime(left.endAt, right.endAt);
    if (endComparison !== 0) return endComparison;

    return left.status.localeCompare(right.status);
  });
}

function compareScheduleTime(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function buildParameterMetadataLookup(
  point: IntegrationConnectedPointDTO,
): ParameterMetadataLookup {
  const exact = new Map<string, ParameterMetadata>();
  const looseBuckets = new Map<string, Array<[string, ParameterMetadata]>>();
  const parameters = point.measurementInstruments?.parameters ?? [];

  for (const parameter of parameters) {
    const name = parameter.parameter?.trim();
    if (!name) continue;

    const values = toParameterMetadata(parameter);
    const exactKey = normalizeParameterKey(name);
    exact.set(exactKey, values);

    const looseKey = normalizeParameterKey(stripTrailingUnit(name));
    const bucket = looseBuckets.get(looseKey) ?? [];
    bucket.push([exactKey, values]);
    looseBuckets.set(looseKey, bucket);
  }

  return {
    get(parameterName: string): ParameterMetadata | null {
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

function toParameterMetadata(parameter: MeasurementInstrumentParameterInput): ParameterMetadata {
  return {
    standardCriteria: readStandardValue(parameter.standardCriteria),
    eiaCriteria: readStandardValue(parameter.eiaCriteria),
    standardCondition: readBoolean(parameter.standardCondition),
    dryBasis: readBoolean(parameter.dryBasis),
    oxygenOrExcessAir: readBoolean(parameter.oxygenOrExcessAir),
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

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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
  const hasMin = Object.prototype.hasOwnProperty.call(range, 'min');
  const hasMax = Object.prototype.hasOwnProperty.call(range, 'max');
  if (!hasMin && !hasMax) return null;
  return {
    min: readNumber(range.min),
    max: readNumber(range.max),
  };
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

function splitParameterAndUnit(parameter: string): { name: string; unit: string | null } {
  const match = parameter.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { name: parameter.trim(), unit: null };

  const name = match[1].trim();
  const unit = match[2].trim();
  return {
    name,
    unit: unit || null,
  };
}
