import { z } from 'zod';
import { DEVICE_CONNECTION_PROTOCOL } from './device-connections.types';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const ipv4Address = z
  .string()
  .trim()
  .max(45)
  .regex(
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/,
    'Invalid IPv4 address',
  );

const positiveInt = z.number().int().positive();
const portNumber = positiveInt.max(65535);
const addressId = z.number().int().min(40001);

const measurementRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .strict()
  .refine((range) => range.min <= range.max, {
    message: 'min must be less than or equal to max',
    path: ['min'],
  });

const dataValueFormatSchema = z.enum(['MEASUREMENT_VALUE', 'CURRENT', 'VOLTAGE']);
const parameterStatusSchema = trimmedString(64)
  .nullable()
  .optional()
  .transform((status) => status ?? 'Normal');
const modbusEncodingSchema = z.enum([
  'SIGNED',
  'UNSIGNED',
  'BIG_ENDIAN',
  'LITTLE_ENDIAN',
  'SIGNED16_BIG_ENDIAN',
  'SIGNED16_LITTLE_ENDIAN',
  'UNSIGNED16_BIG_ENDIAN',
  'UNSIGNED16_LITTLE_ENDIAN',
  'SIGNED32_BIG_ENDIAN',
  'SIGNED32_LITTLE_ENDIAN',
  'UNSIGNED32_BIG_ENDIAN',
  'UNSIGNED32_LITTLE_ENDIAN',
  'FLOAT32_BIG_ENDIAN',
  'FLOAT32_LITTLE_ENDIAN',
  'FLOAT64_BIG_ENDIAN',
  'FLOAT64_LITTLE_ENDIAN',
]);

const modbusEncodingAliases = {
  SIGNED16_BIG_ENDIAN: 'SIGNED16_BIG_ENDIAN',
  SIGNED16_LITTLE_ENDIAN: 'SIGNED16_LITTLE_ENDIAN',
  UNSIGNED16_BIG_ENDIAN: 'UNSIGNED16_BIG_ENDIAN',
  UNSIGNED16_LITTLE_ENDIAN: 'UNSIGNED16_LITTLE_ENDIAN',
  SIGNED32_BIG_ENDIAN: 'SIGNED32_BIG_ENDIAN',
  SIGNED32_LITTLE_ENDIAN: 'SIGNED32_LITTLE_ENDIAN',
  UNSIGNED32_BIG_ENDIAN: 'UNSIGNED32_BIG_ENDIAN',
  UNSIGNED32_LITTLE_ENDIAN: 'UNSIGNED32_LITTLE_ENDIAN',
  FLOAT32_BIG_ENDIAN: 'FLOAT32_BIG_ENDIAN',
  FLOAT32_LITTLE_ENDIAN: 'FLOAT32_LITTLE_ENDIAN',
  FLOAT64_BIG_ENDIAN: 'FLOAT64_BIG_ENDIAN',
  FLOAT64_LITTLE_ENDIAN: 'FLOAT64_LITTLE_ENDIAN',
} as const;

const modbusChannelSchema = z
  .object({
    addressId,
    dataType: trimmedString(128),
    unit: z.string().trim().max(64).optional().default(''),
    valueRange: measurementRangeSchema,
    valueFormat: dataValueFormatSchema.nullable().optional().default('MEASUREMENT_VALUE'),
    offset: z.number(),
    encoding: modbusEncodingSchema,
    status: parameterStatusSchema,
  })
  .strict()
  .transform((channel) => ({
    ...channel,
    valueFormat: channel.valueFormat ?? 'MEASUREMENT_VALUE',
  }));

const databaseChannelSchema = z
  .object({
    addressId,
    dataType: trimmedString(128),
    unit: z.string().trim().max(64).optional().default(''),
    offset: z.number(),
    status: parameterStatusSchema,
  })
  .strict();

const modbusRtuSettingsSchema = z
  .object({
    comPort: positiveInt,
    slaveId: positiveInt,
    baudRate: z.union([
      z.literal(2400),
      z.literal(4800),
      z.literal(9600),
      z.literal(14400),
      z.literal(19200),
      z.literal(38400),
    ]),
    parity: z.enum(['EVEN', 'ODD', 'NONE']).default('NONE'),
    stopBits: z.union([z.literal(1), z.literal(2)]).default(1),
    dataBits: z.union([z.literal(7), z.literal(8)]).default(8),
    quantity: positiveInt,
    valueRange: measurementRangeSchema.nullable().optional(),
  })
  .strict()
  .transform((settings) => ({
    ...settings,
    valueRange: settings.valueRange ?? null,
  }));

const modbusTcpSettingsSchema = z
  .object({
    hostIp: ipv4Address,
    slaveId: positiveInt,
    port: portNumber.default(502),
  })
  .strict();

const mssqlSettingsSchema = z
  .object({
    hostIp: ipv4Address,
    port: portNumber.default(1433),
    dbUser: trimmedString(128),
    dbPass: trimmedString(512),
    dbName: trimmedString(128),
  })
  .strict();

const mysqlSettingsSchema = z
  .object({
    hostIp: ipv4Address,
    port: portNumber.default(3306),
    dbUser: trimmedString(128),
    dbPass: trimmedString(512),
    dbName: trimmedString(128),
  })
  .strict();

const baseDeviceConnectionSchema = z.object({
  stationId: trimmedString(64),
  deviceCode: trimmedString(64).nullable().optional().default(null),
  statusManagement: z
    .object({
      selectedParameters: z.array(trimmedString(128)).min(1).max(50),
      startAt: z.string().trim().min(1).max(64).nullable().optional(),
      endAt: z.string().trim().min(1).max(64).nullable().optional(),
      status: trimmedString(64),
      schedules: z
        .array(
          z
            .object({
              selectedParameters: z.array(trimmedString(128)).min(1).max(50),
              startAt: z.string().trim().min(1).max(64).nullable().optional(),
              endAt: z.string().trim().min(1).max(64).nullable().optional(),
              status: trimmedString(64),
            })
            .strict()
            .transform((schedule) => ({
              ...schedule,
              startAt: schedule.startAt ?? null,
              endAt: schedule.endAt ?? null,
            })),
        )
        .max(50)
        .optional()
        .default([]),
    })
    .strict()
    .transform((statusManagement) => ({
      ...statusManagement,
      startAt: statusManagement.startAt ?? null,
      endAt: statusManagement.endAt ?? null,
    }))
    .nullable()
    .optional()
    .default(null),
});

const deviceConnectionConfigSchema = z.discriminatedUnion('protocol', [
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU),
      settings: modbusRtuSettingsSchema,
      channels: z.array(modbusChannelSchema).min(1).max(200),
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP),
      settings: modbusTcpSettingsSchema,
      channels: z.array(modbusChannelSchema).min(1).max(200),
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MSSQL),
      settings: mssqlSettingsSchema,
      channels: z.array(databaseChannelSchema).min(1).max(200),
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MYSQL),
      settings: mysqlSettingsSchema,
      channels: z.array(databaseChannelSchema).min(1).max(200),
    })
    .strict(),
]);

export const createDeviceConnectionConfigSchema = z.preprocess(
  normalizeLegacyModbusRtuFormPayload,
  deviceConnectionConfigSchema,
);

export const createDeviceConnectionConfigsSchema = z
  .object({
    configs: z.array(createDeviceConnectionConfigSchema).min(1).max(50),
  })
  .strict();

export const createDeviceConnectionConfigRequestSchema = z.union([
  createDeviceConnectionConfigsSchema,
  createDeviceConnectionConfigSchema,
]);

export const testDeviceConnectionSchema = createDeviceConnectionConfigSchema;

export const listDeviceConnectionConfigsQuerySchema = z
  .object({
    stationId: z.string().trim().min(1).max(64),
    protocol: z.nativeEnum(DEVICE_CONNECTION_PROTOCOL).optional(),
  })
  .strict();

export const deviceConnectionConfigIdParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
  })
  .strict();

export type CreateDeviceConnectionConfigSchemaInput = z.infer<
  typeof createDeviceConnectionConfigSchema
>;

export type CreateDeviceConnectionConfigRequestSchemaInput = z.infer<
  typeof createDeviceConnectionConfigRequestSchema
>;

function normalizeLegacyModbusRtuFormPayload(value: unknown): unknown {
  if (!isRecord(value) || !isLegacyModbusRtuPayload(value)) return value;

  const normalized: Record<string, unknown> = {
    stationId: value.stationId,
    deviceCode: value.deviceCode,
    protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
    settings: {
      comPort: parseLeadingNumber(value.COMPORT),
      slaveId: parseLeadingNumber(value.slaveID),
      baudRate: parseLeadingNumber(value.baudRate),
      parity: normalizeParity(value.parity),
      stopBits: parseLeadingNumber(value.stopBits),
      dataBits: parseLeadingNumber(value.dataBits),
      quantity: parseLeadingNumber(value.quantity),
      valueRange: {
        min: parseLeadingNumber(value.measurementMin),
        max: parseLeadingNumber(value.measurementMax),
      },
    },
    channels: normalizeLegacyModbusChannels(value.channels),
    statusManagement: normalizeLegacyStatusManagement(value),
  };

  copyUnknownFields(value, normalized, legacyModbusTopLevelKeys);
  return removeUndefinedProperties(normalized);
}

function isLegacyModbusRtuPayload(value: Record<string, unknown>): boolean {
  if (typeof value.protocol === 'string') return false;
  return typeof value.connection === 'string' && normalizeToken(value.connection) === 'MODBUS_RTU';
}

function normalizeLegacyModbusChannels(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((channel) => {
    if (!isRecord(channel)) return channel;
    const normalized: Record<string, unknown> = {
      addressId: parseLeadingNumber(channel.addressID),
      dataType: typeof channel.parameter === 'string' ? channel.parameter.trim() : channel.parameter,
      unit: channel.unit,
      valueRange: {
        min: parseLeadingNumber(channel.min),
        max: parseLeadingNumber(channel.max),
      },
      valueFormat: normalizeValueFormat(channel.format),
      offset: parseLeadingNumber(channel.offset),
      encoding: normalizeEncoding(channel.encodingData),
      status: channel.status,
    };
    copyUnknownFields(channel, normalized, legacyModbusChannelKeys);
    return removeUndefinedProperties(normalized);
  });
}

function normalizeLegacyStatusManagement(value: Record<string, unknown>): unknown {
  if (
    value.selectedParameters === undefined &&
    value.status === undefined &&
    value.startAt === undefined &&
    value.endAt === undefined
  ) {
    return undefined;
  }

  return {
    selectedParameters:
      typeof value.selectedParameters === 'string'
        ? [value.selectedParameters.trim()]
        : value.selectedParameters,
    startAt: value.startAt ?? null,
    endAt: value.endAt ?? null,
    status: value.status,
    schedules: Array.isArray(value.schedules) ? value.schedules : [],
  };
}

function normalizeParity(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const token = normalizeToken(value);
  if (token.startsWith('NONE')) return 'NONE';
  if (token.startsWith('EVEN')) return 'EVEN';
  if (token.startsWith('ODD')) return 'ODD';
  return value;
}

function normalizeValueFormat(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.includes('ตรวจวัด')) return 'MEASUREMENT_VALUE';
  const token = normalizeToken(value);
  if (token.includes('MEASUREMENT')) return 'MEASUREMENT_VALUE';
  if (token.includes('CURRENT')) return 'CURRENT';
  if (token.includes('VOLTAGE')) return 'VOLTAGE';
  return value;
}

function normalizeEncoding(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const token = normalizeToken(value);
  return modbusEncodingAliases[token as keyof typeof modbusEncodingAliases] ?? value;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseLeadingNumber(value: unknown): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return value;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyUnknownFields(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  knownKeys: Set<string>,
): void {
  for (const [key, sourceValue] of Object.entries(source)) {
    if (!knownKeys.has(key)) target[key] = sourceValue;
  }
}

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

const legacyModbusTopLevelKeys = new Set([
  'stationId',
  'connection',
  'deviceCode',
  'COMPORT',
  'slaveID',
  'baudRate',
  'parity',
  'stopBits',
  'dataBits',
  'measurementMin',
  'measurementMax',
  'quantity',
  'selectedParameters',
  'startAt',
  'endAt',
  'status',
  'schedules',
  'channels',
]);

const legacyModbusChannelKeys = new Set([
  'addressID',
  'parameter',
  'min',
  'max',
  'format',
  'offset',
  'encodingData',
  'status',
]);
