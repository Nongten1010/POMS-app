import type {
  DeviceConnectionConfigDTO,
  DeviceConnectionProtocol,
} from '../device-connections/device-connections.types';
import type { MeasurementInstrumentsInput } from '../connection-requests/connection-requests.types';

export interface IntegrationConnectedPointDTO {
  stationId: string;
  measurementInstruments: MeasurementInstrumentsInput | null;
}

export interface IntegrationDeviceConfigDTO {
  deviceCode: string;
  protocol: DeviceConnectionProtocol;
  hostIp: string | null;
  port: number | null;
  slaveId: number | null;
  comPort: number | null;
  baudRate: number | null;
  parity: string | null;
  stopBits: number | null;
  dataBits: number | null;
  quantity: number | null;
  dbUser: string | null;
  dbPass: string | null;
  dbName: string | null;
  deviceValueRangeMin: number | null;
  deviceValueRangeMax: number | null;
}

export interface IntegrationParameterConfigDTO {
  deviceCode: string;
  addressId: number;
  parameter: string;
  parameterName: string | null;
  parameterUnit: string | null;
  valueRange: { min: number; max: number } | null;
  alertLow: number | null;
  alertHigh: number | null;
  valueFormat: string | null;
  offset: number;
  encoding: string | null;
  standardCriteria: number | string | null;
  eiaCriteria: number | string | null;
  status: string;
}

export interface IntegrationStatusScheduleDTO {
  parameter: string;
  startAt: string | null;
  endAt: string | null;
  status: string;
}

export interface IntegrationDeviceConfigsResponseDTO {
  stationId: string;
  deviceConfigs: IntegrationDeviceConfigDTO[];
  parameterConfigs: IntegrationParameterConfigDTO[];
  statusSchedules: IntegrationStatusScheduleDTO[];
}

export type IntegrationDeviceConfigSource = DeviceConnectionConfigDTO;
