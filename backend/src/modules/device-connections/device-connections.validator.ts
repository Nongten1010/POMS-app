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

const modbusChannelSchema = z
  .object({
    addressId,
    dataType: trimmedString(128),
    unit: trimmedString(64),
    valueRange: measurementRangeSchema,
    valueFormat: dataValueFormatSchema.nullable().optional().default('MEASUREMENT_VALUE'),
    offset: z.number(),
    encoding: modbusEncodingSchema,
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
    unit: trimmedString(64),
    offset: z.number(),
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
});

export const createDeviceConnectionConfigSchema = z.discriminatedUnion('protocol', [
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

export const testDeviceConnectionSchema = createDeviceConnectionConfigSchema;

export const listDeviceConnectionConfigsQuerySchema = z
  .object({
    stationId: z.string().trim().min(1).max(64).optional(),
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
