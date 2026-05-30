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
  min: number;
  max: number;
}

export interface DeviceMeasurementChannelInput {
  addressId: number;
  dataType: string;
  unit: string;
  valueRange?: MeasurementRangeInput | null;
  valueFormat?: DataValueFormat | null;
  offset: number;
  encoding?: ModbusEncoding | null;
}

export interface ModbusRtuConnectionSettingsInput {
  comPort: number;
  slaveId: number;
  baudRate: 2400 | 4800 | 9600 | 14400 | 19200 | 38400;
  parity: ModbusParity;
  stopBits: 1 | 2;
  dataBits: 7 | 8;
  quantity: number;
  valueRange?: MeasurementRangeInput | null;
}

export interface ModbusTcpConnectionSettingsInput {
  hostIp: string;
  slaveId: number;
  port: number;
}

export interface DatabaseConnectionSettingsInput {
  hostIp: string;
  port: number;
  dbUser: string;
  dbPass: string;
  dbName: string;
}

export type DeviceConnectionSettingsInput =
  | ModbusRtuConnectionSettingsInput
  | ModbusTcpConnectionSettingsInput
  | DatabaseConnectionSettingsInput;

export interface BaseDeviceConnectionConfigInput {
  stationId: string;
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
  settings: ModbusRtuConnectionSettingsInput;
}

export interface CreateModbusTcpConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP;
  settings: ModbusTcpConnectionSettingsInput;
}

export interface CreateMssqlConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MSSQL;
  settings: DatabaseConnectionSettingsInput;
}

export interface CreateMysqlConnectionConfigInput extends BaseDeviceConnectionConfigInput {
  protocol: typeof DEVICE_CONNECTION_PROTOCOL.MYSQL;
  settings: DatabaseConnectionSettingsInput;
}

export type CreateDeviceConnectionConfigInput =
  | CreateModbusRtuConnectionConfigInput
  | CreateModbusTcpConnectionConfigInput
  | CreateMssqlConnectionConfigInput
  | CreateMysqlConnectionConfigInput;

export type TestDeviceConnectionInput = CreateDeviceConnectionConfigInput;

export interface ListDeviceConnectionConfigsQuery {
  stationId?: string;
  protocol?: DeviceConnectionProtocol;
}

export interface DeviceConnectionConfigDTO {
  id: number;
  requestId: number | null;
  stationId: string;
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
