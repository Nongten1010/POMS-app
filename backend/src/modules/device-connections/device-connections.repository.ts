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
  station_id: string;
  protocol: DeviceConnectionProtocol;
  settings_json: string;
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

  async create(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO> {
    return db.transaction(async (trx) => {
      const [{ id }] = await trx('device_connection_configs')
        .insert({
          station_id: input.stationId,
          protocol: input.protocol,
          settings_json: JSON.stringify(input.settings),
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
    stationId: row.station_id,
    protocol: row.protocol,
    settings: maskSensitiveSettings(parseJsonObject(row.settings_json)),
    channels: channels.map(toChannelDTO),
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

function maskSensitiveSettings(settings: Record<string, unknown>): Record<string, unknown> {
  if (!('dbPass' in settings)) return settings;
  return { ...settings, dbPass: '********' };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
