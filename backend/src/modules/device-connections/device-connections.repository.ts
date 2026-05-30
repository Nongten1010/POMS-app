import type { Knex } from 'knex';
import { db } from '../../config/database';
import {
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
  address_id: number | string;
  data_type: string;
  unit: string;
  value_range_json: string | null;
  value_format: 'MEASUREMENT_VALUE' | 'CURRENT' | 'VOLTAGE' | null;
  offset_value: number | string;
  encoding: DeviceMeasurementChannelInput['encoding'];
  parameter_status: string | null;
}

export const deviceConnectionsRepository = {
  async list(query: ListDeviceConnectionConfigsQuery): Promise<DeviceConnectionConfigDTO[]> {
    const rows = await db<DeviceConnectionConfigRow>('device_connection_configs')
      .whereNull('deleted_at')
      .modify((builder) => {
        if (query.stationId) builder.where('station_id', query.stationId);
        if (query.protocol) builder.where('protocol', query.protocol);
      })
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc');

    return Promise.all(rows.map((row: DeviceConnectionConfigRow) => hydrate(row)));
  },

  async findById(id: number): Promise<DeviceConnectionConfigDTO | null> {
    const row = await db<DeviceConnectionConfigRow>('device_connection_configs')
      .where('id', id)
      .whereNull('deleted_at')
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

  async existsByStationIdAndProtocol(
    stationId: string,
    protocol: DeviceConnectionProtocol,
  ): Promise<boolean> {
    const row = await db('device_connection_configs')
      .where('station_id', stationId)
      .where('protocol', protocol)
      .whereNull('deleted_at')
      .select('id')
      .first();
    return Boolean(row);
  },

  async create(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    requestId: number | null = null,
  ): Promise<DeviceConnectionConfigDTO> {
    return db.transaction(async (trx) => {
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
      return created;
    });
  },
};

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
): Promise<DeviceConnectionConfigDTO> {
  const executor = trx ?? db;
  const configId = Number(row.id);
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
    settings: maskSensitiveSettings(parseJsonObject(row.settings_json)),
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
  await trx('device_measurement_channels').insert(
    channels.map((channel) => ({
      config_id: configId,
      address_id: channel.addressId,
      data_type: channel.dataType,
      unit: channel.unit,
      value_range_json: channel.valueRange ? JSON.stringify(channel.valueRange) : null,
      value_format: channel.valueFormat ?? null,
      offset_value: channel.offset,
      encoding: channel.encoding ?? null,
      parameter_status: channel.status ?? 'Normal',
      created_by: actorUserId,
      updated_by: actorUserId,
    })),
  );
}

function toChannelDTO(row: DeviceMeasurementChannelRow): DeviceMeasurementChannelInput {
  return {
    addressId: Number(row.address_id),
    dataType: row.data_type,
    unit: row.unit,
    offset: Number(row.offset_value),
    ...(row.value_range_json ? { valueRange: parseMeasurementRange(row.value_range_json) } : {}),
    ...(row.value_format ? { valueFormat: row.value_format } : {}),
    ...(row.encoding ? { encoding: row.encoding } : {}),
    status: row.parameter_status ?? 'Normal',
  };
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
  const min = parsed.min;
  const max = parsed.max;
  if (typeof min !== 'number' || typeof max !== 'number') return null;
  return { min, max };
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
    startAt: typeof parsed.startAt === 'string' ? parsed.startAt : null,
    endAt: typeof parsed.endAt === 'string' ? parsed.endAt : null,
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
            startAt: typeof schedule.startAt === 'string' ? schedule.startAt : null,
            endAt: typeof schedule.endAt === 'string' ? schedule.endAt : null,
            status: typeof schedule.status === 'string' ? schedule.status : 'Normal',
          }))
      : [],
  };
}

function maskSensitiveSettings(settings: Record<string, unknown>): Record<string, unknown> {
  if (!('dbPass' in settings)) return settings;
  return { ...settings, dbPass: '********' };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
