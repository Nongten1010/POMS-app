import { z } from 'zod';
import {
  DEVICE_CONNECTION_PARAMETER_STATUSES,
  DEVICE_CONNECTION_PROTOCOL,
} from './device-connections.types';
import {
  isCanonicalStatusDateTime,
  normalizeStatusDateTimeInput,
  STATUS_DATETIME_FORMAT,
} from './device-connection-status-datetime';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const measurementRangeSchema = z
  .object({
    min: z.number().nullable().optional().default(null),
    max: z.number().nullable().optional().default(null),
  })
  .passthrough();

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

const nullableNumber = z.number().nullable().optional().default(null);
const nullableString = z.string().nullable().optional().default(null);
const defaultFalseBoolean = z.preprocess((value) => value ?? false, z.boolean());
const nullableParameterStatus = z
  .enum(DEVICE_CONNECTION_PARAMETER_STATUSES)
  .nullable()
  .optional()
  .default(null);

const modbusRtuSettingsSchema = defaultNullishObject(
  z
    .object({
      comPort: z.union([z.number(), z.string()]).nullable().optional(),
      slaveId: z.number().nullable().optional(),
      baudRate: z.number().nullable().optional(),
      parity: z.string().nullable().optional(),
      stopBits: z.number().nullable().optional(),
      dataBits: z.number().nullable().optional(),
      quantity: z.number().nullable().optional(),
      valueRange: measurementRangeSchema.nullable().optional(),
    })
    .passthrough(),
);

const modbusTcpSettingsSchema = defaultNullishObject(
  z
    .object({
      hostIp: z.string().nullable().optional(),
      slaveId: z.number().nullable().optional(),
      port: z.number().nullable().optional(),
      valueRange: measurementRangeSchema.nullable().optional(),
    })
    .passthrough(),
);

const databaseSettingsSchema = defaultNullishObject(
  z
    .object({
      hostIp: z.string().nullable().optional(),
      port: z.number().nullable().optional(),
      dbUser: z.string().nullable().optional(),
      dbPass: z.string().nullable().optional(),
      dbName: z.string().nullable().optional(),
      minuteTableName: z.string().nullable().optional(),
      fiveMinuteTableName: z.string().nullable().optional(),
      hourlyTableName: z.string().nullable().optional(),
      valueRange: measurementRangeSchema.nullable().optional(),
    })
    .passthrough(),
);

const pomsBoxSettingsSchema = defaultNullishObject(z.object({}).passthrough());

const configChannelSchema = z
  .object({
    addressId: nullableNumber,
    dataType: z.string(),
    unit: z.string().nullable().optional().default(null),
    testMode: defaultFalseBoolean,
    valueRange: measurementRangeSchema.nullable().optional().default(null),
    alertLow: nullableNumber,
    alertHigh: nullableNumber,
    valueFormat: nullableString,
    offset: nullableNumber,
    encoding: nullableString,
    status: nullableParameterStatus,
  })
  .passthrough()
  .transform(({ unit, ...channel }) => ({
    ...channel,
    dataType: toChannelDataType(channel.dataType, unit),
  }));

const configChannelsSchema = z.preprocess(
  (value) => (value === null || value === undefined ? [] : value),
  z.array(configChannelSchema).max(200),
);

const statusDateTimeSchema = z.preprocess(
  normalizeStatusDateTimeInput,
  z.string().refine(isCanonicalStatusDateTime, {
    message: `Expected a valid datetime in ${STATUS_DATETIME_FORMAT} format`,
  }),
);
const legacyStatusDateTimeSchema = statusDateTimeSchema;
const legacyStatusManagementFieldNames = new Set([
  'selectedParameters',
  'startAt',
  'endAt',
  'status',
]);

const statusScheduleSchema = z
  .object({
    selectedParameters: z.array(trimmedString(128)).min(1).max(200),
    startAt: statusDateTimeSchema,
    endAt: statusDateTimeSchema,
    status: z.enum(DEVICE_CONNECTION_PARAMETER_STATUSES),
  })
  .passthrough()
  .superRefine((schedule, ctx) => {
    if (schedule.startAt && schedule.endAt && schedule.endAt <= schedule.startAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'endAt must be after startAt',
      });
    }
  });

const statusManagementValueSchema = z
  .object({
    selectedParameters: z.array(trimmedString(128)).min(1).max(200).nullable().optional(),
    startAt: legacyStatusDateTimeSchema.nullable().optional(),
    endAt: legacyStatusDateTimeSchema.nullable().optional(),
    status: z.enum(DEVICE_CONNECTION_PARAMETER_STATUSES).nullable().optional(),
    schedules: z.array(statusScheduleSchema).max(100).nullable().optional(),
  })
  .passthrough()
  .superRefine((management, ctx) => {
    if (Boolean(management.startAt) !== Boolean(management.endAt)) {
      ctx.addIssue({
        code: 'custom',
        path: [management.startAt ? 'endAt' : 'startAt'],
        message: 'startAt and endAt must be provided together',
      });
    }
    if (management.startAt && management.endAt && management.endAt <= management.startAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'endAt must be after startAt',
      });
    }

    const schedules = management.schedules ?? [];

    for (let currentIndex = 0; currentIndex < schedules.length; currentIndex += 1) {
      const current = schedules[currentIndex];
      for (let previousIndex = 0; previousIndex < currentIndex; previousIndex += 1) {
        const previous = schedules[previousIndex];
        const overlapsInTime = current.startAt < previous.endAt && previous.startAt < current.endAt;

        if (overlapsInTime && scheduleTargetsOverlap(current, previous)) {
          ctx.addIssue({
            code: 'custom',
            path: ['schedules', currentIndex, 'startAt'],
            message: `Schedule overlaps schedules[${previousIndex}] for the same parameter`,
          });
        }
      }
    }
  })
  .nullable()
  .optional();

const statusManagementSchema = z
  .preprocess(preferExplicitStatusSchedules, statusManagementValueSchema)
  .transform(normalizeStatusManagement);

const baseDeviceConnectionSchema = z.object({
  stationId: trimmedString(64),
  deviceCode: trimmedString(64).nullable().optional().default(null),
  statusManagement: statusManagementSchema,
});

const deviceConnectionConfigSchema = z.discriminatedUnion('protocol', [
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.POMS_BOX),
      settings: pomsBoxSettingsSchema,
      channels: configChannelsSchema,
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU),
      settings: modbusRtuSettingsSchema,
      channels: configChannelsSchema,
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP),
      settings: modbusTcpSettingsSchema,
      channels: configChannelsSchema,
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MSSQL),
      settings: databaseSettingsSchema,
      channels: configChannelsSchema,
    })
    .strict(),
  baseDeviceConnectionSchema
    .extend({
      protocol: z.literal(DEVICE_CONNECTION_PROTOCOL.MYSQL),
      settings: databaseSettingsSchema,
      channels: configChannelsSchema,
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

export const createDeviceConnectionConfigRequestSchema = z.preprocess(
  normalizeStructuredDeviceConfigPayload,
  z.union([createDeviceConnectionConfigsSchema, createDeviceConnectionConfigSchema]),
);

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

function normalizeStructuredDeviceConfigPayload(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.config)) return value;

  const config = value.config;
  const devices = config.device;
  const channels = Array.isArray(config.channels) ? config.channels : [];
  if (!Array.isArray(devices)) return value;

  return {
    configs: devices.map((device) => {
      if (!isRecord(device)) return device;
      const deviceCode = readDeviceCode(device.deviceCode);
      const matchedChannels = channels
        .filter((channel) => isChannelForDevice(channel, deviceCode, devices.length))
        .map(removeChannelDeviceCode);

      return removeUndefinedProperties({
        stationId: config.stationId,
        deviceCode: device.deviceCode,
        protocol: device.protocol,
        settings: device.settings,
        channels: matchedChannels,
        statusManagement: config.statusManagement,
      });
    }),
  };
}

function readDeviceCode(value: unknown): string | null {
  if (typeof value !== 'string') return value == null ? null : String(value);
  const trimmed = value.trim();
  return trimmed || null;
}

function isChannelForDevice(
  channel: unknown,
  deviceCode: string | null,
  deviceCount: number,
): boolean {
  if (!isRecord(channel)) return false;
  const channelDeviceCode = readDeviceCode(channel.deviceCode);
  if (channelDeviceCode !== null) return channelDeviceCode === deviceCode;
  return deviceCount === 1;
}

function removeChannelDeviceCode(channel: unknown): unknown {
  if (!isRecord(channel)) return channel;
  return Object.fromEntries(Object.entries(channel).filter(([key]) => key !== 'deviceCode'));
}

function normalizeStatusManagement(value: unknown): {
  selectedParameters: string[];
  startAt: string | null;
  endAt: string | null;
  status: string;
  schedules: Array<{
    selectedParameters: string[];
    startAt: string | null;
    endAt: string | null;
    status: string;
  }>;
} | null {
  if (!isRecord(value)) return null;

  const schedules = Array.isArray(value.schedules)
    ? value.schedules.flatMap((schedule) => {
        if (!isRecord(schedule)) return [];
        const scheduleParameters = readStringArray(schedule.selectedParameters);
        const scheduleStatus = typeof schedule.status === 'string' ? schedule.status : null;
        if (scheduleParameters === null || scheduleStatus === null) return [];
        return [
          {
            selectedParameters: scheduleParameters,
            startAt: readNullableString(schedule.startAt),
            endAt: readNullableString(schedule.endAt),
            status: scheduleStatus,
          },
        ];
      })
    : [];

  if (schedules.length > 0) {
    return {
      ...schedules[0],
      schedules,
    };
  }

  const selectedParameters = readStringArray(value.selectedParameters);
  const status = typeof value.status === 'string' ? value.status : null;
  if (selectedParameters === null || status === null) return null;

  const legacySchedule = {
    selectedParameters,
    startAt: readNullableString(value.startAt),
    endAt: readNullableString(value.endAt),
    status,
  };

  return {
    ...legacySchedule,
    schedules: value.schedules == null ? [legacySchedule] : schedules,
  };
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === 'string');
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function preferExplicitStatusSchedules(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.schedules) || value.schedules.length === 0) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !legacyStatusManagementFieldNames.has(key)),
  );
}

function scheduleTargetsOverlap(
  left: { selectedParameters: string[] },
  right: { selectedParameters: string[] },
): boolean {
  if (left.selectedParameters.includes('ทั้งหมด') || right.selectedParameters.includes('ทั้งหมด')) {
    return true;
  }

  const rightParameters = new Set(right.selectedParameters);
  return left.selectedParameters.some((parameter) => rightParameters.has(parameter));
}

function toChannelDataType(dataType: string, unit?: string | null): string {
  const trimmedUnit = unit?.trim() ?? '';
  if (!trimmedUnit || /\([^)]*\)\s*$/.test(dataType)) return dataType;
  return `${dataType} (${trimmedUnit})`;
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
      dataType:
        typeof channel.parameter === 'string' ? channel.parameter.trim() : channel.parameter,
      valueRange: {
        min: parseLeadingNumber(channel.min),
        max: parseLeadingNumber(channel.max),
      },
      alertLow: parseLeadingNumber(channel.alertLow),
      alertHigh: parseLeadingNumber(channel.alertHigh),
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

function defaultNullishObject<T extends z.ZodType<Record<string, unknown>>>(schema: T) {
  return z.preprocess((value) => (value === null || value === undefined ? {} : value), schema);
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
  'alertLow',
  'alertHigh',
  'format',
  'offset',
  'encodingData',
  'status',
]);
