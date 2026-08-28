import type { Knex } from 'knex';
import { db } from '../../config/database';
import type { PermissionScopeDetails } from '../auth/permissions';
import { resolveAssignedRegions } from '../auth/regional-access';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { applyFactoryType88Filter } from '../../shared/utils/factory-type-scope';
import { toCanonicalStatusDateTime } from './device-connection-status-datetime';
import {
  type DeviceConnectionAccessContext,
  type CreateDeviceConnectionConfigInput,
  type DeviceConnectionConfigDTO,
  type DeviceConnectionProtocol,
  type DeviceMeasurementChannelInput,
  type ListDeviceConnectionConfigsQuery,
  type MeasurementRangeInput,
} from './device-connections.types';

interface DeviceConnectionConfigRow {
  id: number | string;
  request_id: number | string | null;
  station_id: string;
  device_code: string | null;
  protocol: DeviceConnectionProtocol;
  settings_json: string;
  status_management_json: string | null;
  created_by: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DeviceMeasurementChannelRow {
  address_id: number | string | null;
  data_type: string;
  test_mode: boolean | number | string | null;
  value_range_json: string | null;
  alert_low: number | string | null;
  alert_high: number | string | null;
  value_format: string | null;
  offset_value: number | string | null;
  encoding: string | null;
  parameter_status: string | null;
}

export const deviceConnectionsRepository = {
  async list(
    query: ListDeviceConnectionConfigsQuery,
    access?: DeviceConnectionAccessContext,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return listActiveConfigs(query, 'masked', access);
  },

  async listActiveForIntegration(
    query: ListDeviceConnectionConfigsQuery,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return listActiveConfigs(query, 'plaintext');
  },

  async findById(
    id: number,
    access?: DeviceConnectionAccessContext,
  ): Promise<DeviceConnectionConfigDTO | null> {
    const row = await buildDeviceConnectionAccessQuery(access)
      .where('id', id)
      .first();
    return row ? hydrate(row) : null;
  },

  async listByRequestId(requestId: number): Promise<DeviceConnectionConfigDTO[]> {
    const rows = await db<DeviceConnectionConfigRow>('device_connection_configs')
      .where('request_id', requestId)
      .whereNull('deleted_at')
      .orderBy('id', 'asc');
    return Promise.all(rows.map((row) => hydrate(row)));
  },

  async existsByStationIdProtocolAndDeviceCode(
    stationId: string,
    protocol: DeviceConnectionProtocol,
    deviceCode: string | null,
  ): Promise<boolean> {
    const row = await this.findActiveByStationIdProtocolAndDeviceCode(
      stationId,
      protocol,
      deviceCode,
    );
    return Boolean(row);
  },

  async findActiveByStationIdProtocolAndDeviceCode(
    stationId: string,
    protocol: DeviceConnectionProtocol,
    deviceCode: string | null,
  ): Promise<Pick<
    DeviceConnectionConfigDTO,
    'id' | 'requestId' | 'stationId' | 'protocol' | 'deviceCode'
  > | null> {
    const row = await db('device_connection_configs')
      .where('station_id', stationId)
      .where('protocol', protocol)
      .modify((builder) => {
        if (deviceCode) {
          builder.where('device_code', deviceCode);
        } else {
          builder.whereNull('device_code');
        }
      })
      .whereNull('deleted_at')
      .select('id', 'request_id', 'station_id', 'protocol', 'device_code')
      .whereNull('request_id')
      .first();

    return row
      ? {
          id: Number(row.id),
          requestId: row.request_id === null ? null : Number(row.request_id),
          stationId: row.station_id,
          protocol: row.protocol,
          deviceCode: row.device_code ?? null,
        }
      : null;
  },

  async create(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    requestId: number | null = null,
  ): Promise<DeviceConnectionConfigDTO> {
    const [created] = await this.createMany([input], actorUserId, requestId);
    return created;
  },

  async createMany(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
    requestId: number | null = null,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return db.transaction((trx) => insertConfigs(trx, inputs, actorUserId, requestId));
  },

  async replaceActive(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO> {
    const [saved] = await this.replaceManyActive([input], actorUserId);
    return saved;
  },

  async replaceManyActive(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return db.transaction(async (trx) => {
      for (const input of inputs) {
        await softDeleteActiveConfigByDeviceKey(trx, input, actorUserId);
      }
      return insertConfigs(trx, inputs, actorUserId, null);
    });
  },

  async replaceManyActiveForStation(
    stationId: string,
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return db.transaction(async (trx) => {
      await softDeleteActiveConfigsByStation(trx, stationId, actorUserId);
      return insertConfigs(trx, inputs, actorUserId, null);
    });
  },

  async replaceManyForRequest(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return db.transaction(async (trx) => {
      for (const input of inputs) {
        await softDeleteRequestConfigByDeviceKey(trx, input, actorUserId, requestId);
      }
      return insertConfigs(trx, inputs, actorUserId, requestId);
    });
  },

  async replaceManyForRequestAndActiveSettings(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return db.transaction(async (trx) => {
      for (const input of inputs) {
        await softDeleteRequestConfigByDeviceKey(trx, input, actorUserId, requestId);
        await softDeleteActiveConfigByDeviceKey(trx, input, actorUserId);
      }

      const requestSnapshots = await insertConfigs(trx, inputs, actorUserId, requestId);
      await insertConfigs(trx, inputs, actorUserId, null);
      return requestSnapshots;
    });
  },
};

type SensitiveSettingsMode = 'masked' | 'plaintext';

async function listActiveConfigs(
  query: ListDeviceConnectionConfigsQuery,
  sensitiveSettingsMode: SensitiveSettingsMode,
  access?: DeviceConnectionAccessContext,
): Promise<DeviceConnectionConfigDTO[]> {
  const rows = await buildDeviceConnectionAccessQuery(access)
    .whereNull('request_id')
    .modify((builder) => {
      if (query.stationId) builder.where('station_id', query.stationId);
      if (query.protocol) builder.where('protocol', query.protocol);
    })
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc');

  return Promise.all(
    rows.map((row: DeviceConnectionConfigRow) =>
      hydrate(row, undefined, sensitiveSettingsMode),
    ),
  );
}

function buildDeviceConnectionAccessQuery(access?: DeviceConnectionAccessContext) {
  const query = db<DeviceConnectionConfigRow>('device_connection_configs')
    .whereNull('deleted_at');
  const scopeValue = getAccessScopeValue(access?.scope);
  if (!access || scopeValue === 'ALL') return query;

  return query.whereExists(function deviceConnectionAccessExists() {
    this.select(db.raw('1'))
      .from('cems_wpms_connected_measurement_points as cp')
      .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
        this.on('ef.id', '=', 'cp.eligible_factory_id').andOnNull('ef.deleted_at');
      })
      .leftJoin('factories as f', function joinFactory() {
        this.on('f.fid', '=', 'cp.factory_id').orOn('f.code', '=', 'cp.factory_id').andOnNull('f.deleted_at');
      })
      .leftJoin('provinces as pr', 'pr.id', 'f.province_id')
      .leftJoin('industrial_estates as ie', function joinEstate() {
        this.on('ie.id', '=', 'f.industrial_estate_id').andOnNull('ie.deleted_at');
      })
      .leftJoin('cems_wpms_request_factory_snapshots as fs', function joinSnapshot() {
        this.on('fs.request_id', '=', 'cp.source_request_id').andOnNull('fs.deleted_at');
      })
      .whereRaw('cp.point_code = device_connection_configs.station_id')
      .whereNull('cp.deleted_at');

    applyDeviceConnectionLocationFilter(this, access);
  });
}

function applyDeviceConnectionLocationFilter(
  builder: Knex.QueryBuilder,
  access: DeviceConnectionAccessContext,
): void {
  const scope = toScopeDetails(access.scope);
  switch (scope.scope) {
    case 'IN_REGION': {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      if (regions.length === 0) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.where((regionBuilder) => {
        regionBuilder.whereIn('pr.region', regions).orWhereIn('fs.region_name', regions);
      });
      return;
    }
    case 'IN_PROVINCE': {
      const province = normalizeLocationValue(scope.province);
      if (!province) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.where((provinceBuilder) => {
        provinceBuilder.where('pr.name_th', province).orWhere('fs.province_name', province);
      });
      return;
    }
    case 'IN_ESTATE': {
      const estate = getScopeEstateCode(scope);
      if (!estate) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.where((estateBuilder) => {
        estateBuilder.where('ie.code', estate).orWhere('fs.industrial_estate_code', estate);
      });
      return;
    }
    case 'OWN_FACTORY':
      builder.where((ownBuilder) => {
        ownBuilder.whereExists(function assignedFactory() {
          this.select(db.raw('1')).from('factories as f').whereRaw('f.fid = cp.factory_id OR f.code = cp.factory_id');
          applyAssignedFactoryAccessFilter(this, access.actorUserId);
        });
      });
      return;
    case 'FACTORY_TYPE_88':
      applyFactoryType88Filter(builder, [
        'ef.factory_type_sequence',
        'fs.factory_main_type_code',
      ]);
      return;
    default:
      builder.whereRaw('1 = 0');
  }
}

function getAccessScopeValue(
  scope: DeviceConnectionAccessContext['scope'] | undefined,
): string | null | undefined {
  return scope && typeof scope === 'object' ? scope.scope : scope;
}

function toScopeDetails(scope: DeviceConnectionAccessContext['scope']): PermissionScopeDetails {
  return scope && typeof scope === 'object'
    ? scope
    : { scope: (scope ?? null) as PermissionScopeDetails['scope'] };
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function getScopeEstateCode(scope: PermissionScopeDetails): string | null {
  return normalizeLocationValue(scope.estateCode ?? scope.estate ?? null);
}

export function buildDeviceConnectionAccessQueryForTests(access: DeviceConnectionAccessContext) {
  return buildDeviceConnectionAccessQuery(access);
}

async function insertConfigs(
  trx: Knex.Transaction,
  inputs: CreateDeviceConnectionConfigInput[],
  actorUserId: number,
  requestId: number | null,
): Promise<DeviceConnectionConfigDTO[]> {
  const createdConfigs: DeviceConnectionConfigDTO[] = [];

  for (const input of inputs) {
    const [{ id }] = await trx('device_connection_configs')
      .insert({
        request_id: requestId,
        station_id: input.stationId,
        device_code: input.deviceCode ?? null,
        protocol: input.protocol,
        settings_json: JSON.stringify(input.settings),
        status_management_json: input.statusManagement
          ? JSON.stringify(input.statusManagement)
          : null,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .returning('id');

    const configId = Number(id);
    await insertChannels(trx, configId, input.channels, actorUserId);

    const created = await findByIdInTransaction(trx, configId);
    if (!created) throw new Error('Created device connection config could not be loaded');
    createdConfigs.push(created);
  }

  return createdConfigs;
}

async function softDeleteRequestConfigByDeviceKey(
  trx: Knex.Transaction,
  input: CreateDeviceConnectionConfigInput,
  actorUserId: number,
  requestId: number,
): Promise<void> {
  const rows = await trx<DeviceConnectionConfigRow>('device_connection_configs')
    .where('request_id', requestId)
    .where('station_id', input.stationId)
    .where('protocol', input.protocol)
    .modify((builder) => {
      if (input.deviceCode) {
        builder.where('device_code', input.deviceCode);
      } else {
        builder.whereNull('device_code');
      }
    })
    .whereNull('deleted_at')
    .select('id');

  const configIds = rows.map((row: Pick<DeviceConnectionConfigRow, 'id'>) => Number(row.id));
  if (configIds.length === 0) return;

  const auditUpdate = {
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  };

  await trx('device_measurement_channels')
    .whereIn('config_id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
  await trx('device_connection_configs')
    .whereIn('id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
}

async function softDeleteActiveConfigByDeviceKey(
  trx: Knex.Transaction,
  input: CreateDeviceConnectionConfigInput,
  actorUserId: number,
): Promise<void> {
  const rows = await trx<DeviceConnectionConfigRow>('device_connection_configs')
    .whereNull('request_id')
    .where('station_id', input.stationId)
    .where('protocol', input.protocol)
    .modify((builder) => {
      if (input.deviceCode) {
        builder.where('device_code', input.deviceCode);
      } else {
        builder.whereNull('device_code');
      }
    })
    .whereNull('deleted_at')
    .select('id');

  const configIds = rows.map((row: Pick<DeviceConnectionConfigRow, 'id'>) => Number(row.id));
  if (configIds.length === 0) return;

  const auditUpdate = {
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  };

  await trx('device_measurement_channels')
    .whereIn('config_id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
  await trx('device_connection_configs')
    .whereIn('id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
}

async function softDeleteActiveConfigsByStation(
  trx: Knex.Transaction,
  stationId: string,
  actorUserId: number,
): Promise<void> {
  const rows = await trx<DeviceConnectionConfigRow>('device_connection_configs')
    .whereNull('request_id')
    .where('station_id', stationId)
    .whereNull('deleted_at')
    .select('id');

  const configIds = rows.map((row: Pick<DeviceConnectionConfigRow, 'id'>) => Number(row.id));
  if (configIds.length === 0) return;

  const auditUpdate = {
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  };

  await trx('device_measurement_channels')
    .whereIn('config_id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
  await trx('device_connection_configs')
    .whereIn('id', configIds)
    .whereNull('deleted_at')
    .update(auditUpdate);
}

async function findByIdInTransaction(
  trx: Knex.Transaction,
  id: number,
): Promise<DeviceConnectionConfigDTO | null> {
  const row = await trx<DeviceConnectionConfigRow>('device_connection_configs')
    .where('id', id)
    .whereNull('deleted_at')
    .first();
  return row ? hydrate(row, trx) : null;
}

async function hydrate(
  row: DeviceConnectionConfigRow,
  trx?: Knex.Transaction,
  sensitiveSettingsMode: SensitiveSettingsMode = 'masked',
): Promise<DeviceConnectionConfigDTO> {
  const executor = trx ?? db;
  const configId = Number(row.id);
  const settings = parseJsonObject(row.settings_json);
  const channels = await executor<DeviceMeasurementChannelRow>('device_measurement_channels')
    .where('config_id', configId)
    .whereNull('deleted_at')
    .orderBy('id', 'asc');

  return {
    id: configId,
    requestId: row.request_id === null ? null : Number(row.request_id),
    stationId: row.station_id,
    deviceCode: row.device_code ?? null,
    protocol: row.protocol,
    settings:
      sensitiveSettingsMode === 'plaintext' ? settings : maskSensitiveSettings(settings),
    channels: channels.map(toChannelDTO),
    statusManagement: parseStatusManagement(row.status_management_json),
    createdBy: Number(row.created_by),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function insertChannels(
  trx: Knex.Transaction,
  configId: number,
  channels: DeviceMeasurementChannelInput[],
  actorUserId: number,
): Promise<void> {
  if (channels.length === 0) return;

  await trx('device_measurement_channels').insert(
    channels.map((channel) => ({
      config_id: configId,
      address_id: channel.addressId,
      data_type: toStoredChannelDataType(channel),
      test_mode: channel.testMode ?? false,
      value_range_json: channel.valueRange ? JSON.stringify(channel.valueRange) : null,
      alert_low: channel.alertLow ?? null,
      alert_high: channel.alertHigh ?? null,
      value_format: channel.valueFormat ?? null,
      offset_value: channel.offset,
      encoding: channel.encoding ?? null,
      parameter_status: channel.status ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
    })),
  );
}

function toChannelDTO(row: DeviceMeasurementChannelRow): DeviceMeasurementChannelInput {
  return {
    addressId: toNullableNumber(row.address_id),
    dataType: row.data_type,
    testMode: toBoolean(row.test_mode),
    valueRange: row.value_range_json ? parseMeasurementRange(row.value_range_json) : null,
    alertLow: toNullableNumber(row.alert_low),
    alertHigh: toNullableNumber(row.alert_high),
    valueFormat: row.value_format ?? null,
    offset: toNullableNumber(row.offset_value),
    encoding: row.encoding ?? null,
    status: row.parameter_status ?? null,
  };
}

function toStoredChannelDataType(channel: DeviceMeasurementChannelInput): string {
  const unit = channel.unit?.trim() ?? '';
  if (!unit || /\([^)]*\)\s*$/.test(channel.dataType)) return channel.dataType;
  return `${channel.dataType} (${unit})`;
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function parseMeasurementRange(value: string): MeasurementRangeInput | null {
  const parsed = parseJsonObject(value);
  const hasMin = Object.prototype.hasOwnProperty.call(parsed, 'min');
  const hasMax = Object.prototype.hasOwnProperty.call(parsed, 'max');
  if (!hasMin && !hasMax) return null;
  return {
    min: toNullableNumber(parsed.min),
    max: toNullableNumber(parsed.max),
  };
}

function parseStatusManagement(
  value: string | null,
): DeviceConnectionConfigDTO['statusManagement'] {
  if (!value) return null;
  const parsed = parseJsonObject(value);
  if (!Array.isArray(parsed.selectedParameters) || typeof parsed.status !== 'string') {
    return null;
  }
  return {
    selectedParameters: parsed.selectedParameters.filter((item): item is string => {
      return typeof item === 'string';
    }),
    startAt: toCanonicalStatusDateTime(parsed.startAt),
    endAt: toCanonicalStatusDateTime(parsed.endAt),
    status: parsed.status,
    schedules: Array.isArray(parsed.schedules)
      ? parsed.schedules
          .filter((item): item is Record<string, unknown> => {
            return item !== null && typeof item === 'object' && !Array.isArray(item);
          })
          .map((schedule) => ({
            selectedParameters: Array.isArray(schedule.selectedParameters)
              ? schedule.selectedParameters.filter(
                  (item): item is string => typeof item === 'string',
                )
              : [],
            startAt: toCanonicalStatusDateTime(schedule.startAt),
            endAt: toCanonicalStatusDateTime(schedule.endAt),
            status: typeof schedule.status === 'string' ? schedule.status : 'Normal',
          }))
      : [],
  };
}

function maskSensitiveSettings(settings: Record<string, unknown>): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(settings, 'dbPass') || settings.dbPass == null) {
    return settings;
  }
  return { ...settings, dbPass: '********' };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  return false;
}
