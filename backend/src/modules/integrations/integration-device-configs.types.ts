import type {
  DeviceConnectionConfigDTO,
  DeviceConnectionProtocol,
} from '../device-connections/device-connections.types';
import type {
  ConnectionSystemType,
  MeasurementInstrumentsInput,
  MeasurementPointType,
} from '../connection-requests/connection-requests.types';

export type IntegrationMonitoringPointKind = 'CEMS' | 'WPMS' | 'MOBILE' | 'STATION';
export type IntegrationMeasurementPointType = IntegrationMonitoringPointKind | 'UNKNOWN';

export interface IntegrationConnectedPointDTO {
  stationId: string;
  systemType: ConnectionSystemType;
  pointType: MeasurementPointType;
  monitoringPointKind: unknown;
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
  minuteTableName: string | null;
  fiveMinuteTableName: string | null;
  hourlyTableName: string | null;
  deviceValueRangeMin: number | null;
  deviceValueRangeMax: number | null;
}

export interface IntegrationParameterConfigDTO {
  deviceCode: string;
  addressId: number | null;
  parameter: string;
  parameterName: string | null;
  parameterUnit: string | null;
  valueRange: { min: number | null; max: number | null } | null;
  alertLow: number | null;
  alertHigh: number | null;
  valueFormat: string | null;
  offset: number | null;
  encoding: string | null;
  standardCriteria: number | string | null;
  eiaCriteria: number | string | null;
  standardCondition: boolean | null;
  dryBasis: boolean | null;
  oxygenOrExcessAir: boolean | null;
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
  measurementPointType: IntegrationMeasurementPointType;
  systemType: ConnectionSystemType;
  pointType: MeasurementPointType;
  monitoringPointKind: IntegrationMonitoringPointKind | null;
  deviceConfigs: IntegrationDeviceConfigDTO[];
  parameterConfigs: IntegrationParameterConfigDTO[];
  statusSchedules: IntegrationStatusScheduleDTO[];
}

export type IntegrationDeviceConfigSource = DeviceConnectionConfigDTO;
