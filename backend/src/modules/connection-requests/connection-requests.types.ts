import type { DeviceConnectionConfigDTO } from '../device-connections/device-connections.types';

export const CONNECTION_REQUEST_STATUS = {
  PENDING_DESIGN_REVIEW: 'PENDING_DESIGN_REVIEW',
  WAITING_CONNECTION: 'WAITING_CONNECTION',
  WAITING_FACTORY_REVISION: 'WAITING_FACTORY_REVISION',
  REVISED_PENDING_DESIGN_REVIEW: 'REVISED_PENDING_DESIGN_REVIEW',
  CONNECTION_CONFIRMED: 'CONNECTION_CONFIRMED',
  CONNECTED: 'CONNECTED',
} as const;

export type ConnectionRequestStatus =
  (typeof CONNECTION_REQUEST_STATUS)[keyof typeof CONNECTION_REQUEST_STATUS];

export const CONNECTION_REQUEST_TYPE = {
  NEW_CONNECTION: 'NEW_CONNECTION',
  ADD_MEASUREMENT_POINT: 'ADD_MEASUREMENT_POINT',
  ADD_PARAMETER: 'ADD_PARAMETER',
} as const;

export type ConnectionRequestType =
  (typeof CONNECTION_REQUEST_TYPE)[keyof typeof CONNECTION_REQUEST_TYPE];

export const CONNECTION_REQUEST_TYPE_LABELS: Record<ConnectionRequestType, string> = {
  [CONNECTION_REQUEST_TYPE.NEW_CONNECTION]: 'ขอเชื่อมต่อใหม่',
  [CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT]: 'เพิ่มจุดตรวจวัด',
  [CONNECTION_REQUEST_TYPE.ADD_PARAMETER]: 'เพิ่มพารามิเตอร์',
};

export const CONNECTION_REQUEST_STATUS_LABELS: Record<ConnectionRequestStatus, string> = {
  [CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW]: 'รอพิจารณาแบบ',
  [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]: 'รอเชื่อมต่อ',
  [CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION]: 'รอโรงงานแก้ไข',
  [CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW]: 'แก้ไขแล้ว/รอพิจารณาแบบ',
  [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]: 'ยืนยันการเชื่อมต่อ',
  [CONNECTION_REQUEST_STATUS.CONNECTED]: 'เชื่อมต่อแล้ว',
};

export type ConnectionSystemType = 'CEMS' | 'WPMS';
export type MeasurementPointType = 'STACK' | 'WASTEWATER' | 'OTHER';

export interface MeasurementPointInput {
  pointName: string;
  pointCode?: string | null;
  pointType: MeasurementPointType;
  latitude?: number | null;
  longitude?: number | null;
  parameters: string[];
  description?: string | null;
}

export interface CreateConnectionRequestInput {
  requestType?: ConnectionRequestType;
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  systemType: ConnectionSystemType;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  measurementPoints: MeasurementPointInput[];
  remarks?: string | null;
}

export type ResubmitConnectionRequestInput = CreateConnectionRequestInput;

export interface AddMeasurementPointRequestInput extends CreateConnectionRequestInput {
  requestType: typeof CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT;
}

export interface AddParameterRequestInput extends CreateConnectionRequestInput {
  requestType: typeof CONNECTION_REQUEST_TYPE.ADD_PARAMETER;
}

export interface ListConnectionRequestsQuery {
  status?: ConnectionRequestStatus;
  requestType?: ConnectionRequestType;
  factoryId?: string;
}

export interface ReviewConnectionRequestInput {
  decision: 'APPROVE_DESIGN' | 'REQUEST_REVISION';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface ChangeConnectionRequestStatusInput {
  action: 'APPROVE_FORM' | 'REQUEST_REVISION';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface ConfirmConnectionInput {
  confirmedAt?: string;
  note?: string | null;
}

export interface VerifyConnectionInput {
  verifiedAt?: string;
  note?: string | null;
}

export interface MeasurementPointDTO extends MeasurementPointInput {
  id: number;
}

export interface StatusHistoryDTO {
  id: number;
  status: ConnectionRequestStatus;
  statusLabel: string;
  note: string | null;
  changedBy: number;
  changedAt: string;
}

export interface ConnectionRequestDTO {
  id: number;
  requestNo: string;
  requestType: ConnectionRequestType;
  requestTypeLabel: string;
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  systemType: ConnectionSystemType;
  status: ConnectionRequestStatus;
  statusLabel: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  remarks: string | null;
  revisionReason: string | null;
  officerNote: string | null;
  connectionDueAt: string | null;
  confirmedAt: string | null;
  verifiedAt: string | null;
  measurementPoints: MeasurementPointDTO[];
  statusHistory: StatusHistoryDTO[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedConnectionRequestsDTO {
  data: ConnectionRequestDTO[];
  meta: {
    total: number;
  };
}

export interface FactorySummaryDTO {
  id: number | null;
  factoryId: string;
  factoryName: string;
  newRegistrationNo: string;
  oldRegistrationNo: string | null;
  industryType: string | null;
  industryMainOrder: string | null;
  industrySubOrder: string | null;
  businessActivity: string | null;
  eia: 'มี' | 'ไม่มี' | null;
  projectName: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  province: string | null;
}

export interface ConnectionRequestTableRowDTO {
  id: number;
  factoryId: string;
  factoryName: string;
  industryType: string | null;
  province: string | null;
  type: ConnectionSystemType;
  requestNo: string;
  submittedAt: string;
  submittedDate: string;
  monitoringPointCode: string | null;
  codeIssuedAt: string | null;
  codeIssuedDate: string | null;
  form: string;
  status: string;
  statusCode: ConnectionRequestStatus;
  requestType: ConnectionRequestType;
}

export interface OperatorFactoryTableRowDTO extends FactorySummaryDTO {
  monitoringPointCount: number;
  requestStatus: string;
  requestStatusCode: ConnectionRequestStatus | null;
  status: 'แสดง' | 'ซ่อน';
}

export interface ConnectionRequestDetailDTO extends ConnectionRequestDTO {
  factory: FactorySummaryDTO | null;
  deviceConfigs: DeviceConnectionConfigDTO[];
}

export interface ConnectedMeasurementPointDetailDTO {
  id: number;
  requestId: number;
  requestNo: string;
  factory: FactorySummaryDTO | null;
  type: ConnectionSystemType;
  status: string;
  statusCode: ConnectionRequestStatus;
  connectedAt: string | null;
  point: MeasurementPointDTO;
  deviceConfigs: ConnectionRequestDetailDTO['deviceConfigs'];
}

export interface DeviceConfigFormConnectionDTO {
  id: number;
  configId: number;
  type: 'Modbus RTU' | 'Modbus TCP' | 'Microsoft SQL' | 'MySQL';
  protocol: string;
  deviceCode: string;
  values: Record<string, string>;
}

export interface DeviceConfigFormParameterMappingDTO {
  configId: number;
  deviceCode: string;
  addressId: string;
  parameter: string;
  unit: string;
  min: string;
  max: string;
  valueFormat: string;
  offset: string;
  encodingData: string;
  status: string;
}

export interface DeviceConfigFormStatusManagementDTO {
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
}

export interface DeviceConfigFormDetailDTO {
  requestId: number;
  requestNo: string;
  stationId: string;
  monitoringPoint: MeasurementPointDTO | null;
  parameterOptions: string[];
  deviceCodeOptions: string[];
  connectionForms: DeviceConfigFormConnectionDTO[];
  statusManagement: DeviceConfigFormStatusManagementDTO;
  parameterMappings: DeviceConfigFormParameterMappingDTO[];
  testResults: unknown[];
  rawConfigs: ConnectionRequestDetailDTO['deviceConfigs'];
}

export interface PaginatedTableRowsDTO<T> {
  data: T[];
  meta: {
    total: number;
  };
}
