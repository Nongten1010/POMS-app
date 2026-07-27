export const DEVICE_CONNECTION_PROTOCOL = {
  MODBUS_RTU: 'MODBUS_RTU',
  MODBUS_TCP: 'MODBUS_TCP',
  MSSQL: 'MSSQL',
  MYSQL: 'MYSQL',
} as const;

export type DeviceConnectionProtocol =
  (typeof DEVICE_CONNECTION_PROTOCOL)[keyof typeof DEVICE_CONNECTION_PROTOCOL];

export type DataValueFormat = 'MEASUREMENT_VALUE' | 'CURRENT' | 'VOLTAGE';
export type ModbusParity = 'EVEN' | 'ODD' | 'NONE';
export type ModbusEncoding =
  | 'SIGNED'
  | 'UNSIGNED'
  | 'BIG_ENDIAN'
  | 'LITTLE_ENDIAN'
  | 'SIGNED16_BIG_ENDIAN'
  | 'SIGNED16_LITTLE_ENDIAN'
  | 'UNSIGNED16_BIG_ENDIAN'
  | 'UNSIGNED16_LITTLE_ENDIAN'
  | 'SIGNED32_BIG_ENDIAN'
  | 'SIGNED32_LITTLE_ENDIAN'
  | 'UNSIGNED32_BIG_ENDIAN'
  | 'UNSIGNED32_LITTLE_ENDIAN'
  | 'FLOAT32_BIG_ENDIAN'
  | 'FLOAT32_LITTLE_ENDIAN'
  | 'FLOAT64_BIG_ENDIAN'
  | 'FLOAT64_LITTLE_ENDIAN';

export interface MeasurementRangeInput {
  min: number | null;
  max: number | null;
}

export interface DeviceMeasurementChannelInput {
  addressId: number | null;
  dataType: string;
  unit?: string | null;
  valueRange?: MeasurementRangeInput | null;
  alertLow?: number | null;
  alertHigh?: number | null;
  valueFormat?: string | null;
  offset: number | null;
  encoding?: string | null;
  status?: string | null;
}

export interface ModbusRtuConnectionSettingsInput extends Record<string, unknown> {
  comPort?: number | string | null;
  slaveId?: number | null;
  baudRate?: number | null;
  parity?: ModbusParity | string | null;
  stopBits?: number | null;
  dataBits?: number | null;
  quantity?: number | null;
  valueRange?: MeasurementRangeInput | null;
}

export interface ModbusTcpConnectionSettingsInput extends Record<string, unknown> {
  hostIp?: string | null;
  slaveId?: number | null;
  port?: number | null;
  valueRange?: MeasurementRangeInput | null;
}

export interface DatabaseConnectionSettingsInput extends Record<string, unknown> {
  hostIp?: string | null;
  port?: number | null;
  dbUser?: string | null;
  dbPass?: string | null;
  dbName?: string | null;
  minuteTableName?: string | null;
  fiveMinuteTableName?: string | null;
  hourlyTableName?: string | null;
  valueRange?: MeasurementRangeInput | null;
}

export type DeviceConnectionSettingsInput = Record<string, unknown>;

export interface BaseDeviceConnectionConfigInput {
  stationId: string;
  deviceCode?: string | null;
  channels: DeviceMeasurementChannelInput[];
  statusManagement?: DeviceConnectionStatusManagementInput | null;
}

export interface DeviceConnectionStatusScheduleInput {
  selectedParameters: string[];
  startAt: string | null;
  endAt: string | null;
  status: string;
}

export interface DeviceConnectionStatusManagementInput extends DeviceConnectionStatusScheduleInput {
  schedules: DeviceConnectionStatusScheduleInput[];
}

export interface CreateModbusRtuConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU;
  settings: DeviceConnectionSettingsInput;
}

export interface CreateModbusTcpConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP;
  settings: DeviceConnectionSettingsInput;
}

export interface CreateMssqlConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MSSQL;
  settings: DeviceConnectionSettingsInput;
}

export interface CreateMysqlConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MYSQL;
  settings: DeviceConnectionSettingsInput;
}

export type CreateDeviceConnectionConfigInput =
  | CreateModbusRtuConnectionConfigInput
  | CreateModbusTcpConnectionConfigInput
  | CreateMssqlConnectionConfigInput
  | CreateMysqlConnectionConfigInput;

export interface CreateDeviceConnectionConfigsInput {
  configs: CreateDeviceConnectionConfigInput[];
}

export type TestDeviceConnectionInput = CreateDeviceConnectionConfigInput;

export interface ListDeviceConnectionConfigsQuery {
  stationId?: string;
  protocol?: DeviceConnectionProtocol;
}

export interface DeviceConnectionConfigDTO {
  id: number;
  requestId: number | null;
  stationId: string;
  deviceCode?: string | null;
  protocol: DeviceConnectionProtocol;
  settings: Record<string, unknown>;
  channels: DeviceMeasurementChannelInput[];
  statusManagement: DeviceConnectionStatusManagementInput | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceConnectionTestResultDTO {
  success: boolean;
  mode: 'MOCK';
  protocol: DeviceConnectionProtocol;
  stationId: string;
  message: string;
  checkedAt: string;
  details: {
    endpoint: string;
    channelCount: number;
  };
}
