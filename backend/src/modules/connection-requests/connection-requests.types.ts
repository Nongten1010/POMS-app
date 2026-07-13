import type { ConnectionRequestEiaAssessment } from './connection-request-eia';

export const CONNECTION_REQUEST_STATUS = {
  PENDING_DESIGN_REVIEW: 'PENDING_DESIGN_REVIEW',
  WAITING_CONNECTION: 'WAITING_CONNECTION',
  WAITING_FACTORY_REVISION: 'WAITING_FACTORY_REVISION',
  REVISED_PENDING_DESIGN_REVIEW: 'REVISED_PENDING_DESIGN_REVIEW',
  CONNECTION_CONFIRMED: 'CONNECTION_CONFIRMED',
  CONNECTED: 'CONNECTED',
  CANCELED: 'CANCELED',
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
  [CONNECTION_REQUEST_STATUS.CANCELED]: 'ยกเลิก',
};

export type ConnectionSystemType = 'CEMS' | 'WPMS';
export type MeasurementPointType = 'STACK' | 'WASTEWATER' | 'OTHER';

export type MeasurementPointDetailsInput = Record<string, unknown>;

export interface RequestDocumentImageInput {
  title: string;
  description?: string | null;
  link?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
}

export interface MeasurementInstrumentParameterInput {
  parameter: string;
  technique?: string | null;
  range?: string | null;
  brand?: string | null;
  supplier?: string | null;
  eiaStandard?: string | null;
  standardCondition?: boolean | null;
  dryBasis?: boolean | null;
  oxygenOrExcessAir?: boolean | null;
  standardCriteria?: unknown;
  eiaCriteria?: unknown;
}

export interface MeasurementInstrumentsInput {
  converterBrand?: string | null;
  converterModel?: string | null;
  parameters: MeasurementInstrumentParameterInput[];
}

export interface ContactPersonInput {
  name: string;
  phone: string;
  email?: string | null;
  position?: string | null;
}

export interface MeasurementPointInput {
  pointName: string;
  pointCode?: string | null;
  pointType: MeasurementPointType;
  latitude?: number | null;
  longitude?: number | null;
  parameters?: string[];
  description?: string | null;
  details?: MeasurementPointDetailsInput | null;
  documentsAndImages?: RequestDocumentImageInput[];
  measurementInstruments?: MeasurementInstrumentsInput | null;
}

export interface CreateConnectionRequestInput {
  requestType?: ConnectionRequestType;
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  industryMainOrder?: string | null;
  industryMainOrderLabel?: string | null;
  industrySubOrder?: string | null;
  businessActivity?: string | null;
  eia?: ConnectionRequestEiaAssessment | null;
  eiaOther?: string | null;
  hasEia?: boolean | null;
  projectName?: string | null;
  address?: string | null;
  regionCode?: string | null;
  regionName?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  subdistrictCode?: string | null;
  subdistrictName?: string | null;
  industrialEstateCode?: string | null;
  industrialEstateName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  systemType: ConnectionSystemType;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  contactPersons?: ContactPersonInput[];
  notificationEmails?: string[];
  officerNotificationEmails?: string[];
  informationProviderName?: string | null;
  informationProviderPosition?: string | null;
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
  stationId?: string;
  regionName?: string;
  provinceName?: string;
  districtName?: string;
  subdistrictName?: string;
  industrialEstateName?: string;
  factoryMainTypeCode?: string;
}

export interface ListConnectedMeasurementPointsQuery {
  factoryId?: string;
  stationId?: string;
}

export interface ListOperatorFactoriesQuery {
  systemType?: ConnectionSystemType;
  favoriteOnly?: boolean;
  connectedOnly?: boolean;
}

export interface ListPublicFactoryMapPointsQuery {
  systemType?: ConnectionSystemType;
}

export interface ReviewConnectionRequestInput {
  decision: 'APPROVE_DESIGN' | 'REQUEST_REVISION';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface ChangeConnectionRequestStatusInput {
  action: 'APPROVE_FORM' | 'REQUEST_REVISION' | 'RETURN_TO_WAITING_CONNECTION';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface ConfirmConnectionInput {
  action?: 'SAVE' | 'CONFIRM';
  confirmedAt?: string;
  note?: string | null;
}

export interface VerifyConnectionInput {
  verifiedAt?: string;
  note?: string | null;
}

export interface MeasurementPointDTO extends Omit<MeasurementPointInput, 'parameters'> {
  id: number;
  parameters: string[];
}

export interface StatusHistoryDTO {
  id: number;
  status: ConnectionRequestStatus;
  statusLabel: string;
  note: string | null;
  changedById: number;
  changedBy: string;
  changedAt: string;
  endedAt: string | null;
  durationDays: number | null;
  durationText: string | null;
  isTerminal: boolean;
}

export interface StatusDurationSummaryDTO {
  startedAt: string | null;
  startDate: string | null;
  startStatus: ConnectionRequestStatus | null;
  startStatusLabel: string | null;
  endedAt: string | null;
  endDate: string | null;
  endStatus: ConnectionRequestStatus | null;
  endStatusLabel: string | null;
  isTerminal: boolean;
  terminalStatuses: ConnectionRequestStatus[];
  totalDurationDays: number | null;
  totalDurationText: string | null;
}

export interface ConnectionRequestDTO {
  id: number;
  requestNo: string;
  requestType: ConnectionRequestType;
  requestTypeLabel: string;
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  industryMainOrder: string | null;
  industryMainOrderLabel: string | null;
  industrySubOrder: string | null;
  businessActivity: string | null;
  eia: ConnectionRequestEiaAssessment | null;
  eiaOther: string | null;
  hasEia: boolean | null;
  projectName: string | null;
  address: string | null;
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  districtCode: string | null;
  districtName: string | null;
  subdistrictCode: string | null;
  subdistrictName: string | null;
  industrialEstateCode: string | null;
  industrialEstateName: string | null;
  latitude: number | null;
  longitude: number | null;
  systemType: ConnectionSystemType;
  status: ConnectionRequestStatus;
  statusLabel: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  contactPersons: ContactPersonInput[];
  notificationEmails: string[];
  officerNotificationEmails: string[];
  informationProviderName: string | null;
  informationProviderPosition: string | null;
  remarks: string | null;
  revisionReason: string | null;
  officerNote: string | null;
  connectionDueAt: string | null;
  confirmedAt: string | null;
  verifiedAt: string | null;
  measurementPoints: MeasurementPointDTO[];
  statusHistory: StatusHistoryDTO[];
  statusDurationSummary: StatusDurationSummaryDTO;
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
  industryMainOrderLabel?: string | null;
  industrySubOrder: string | null;
  businessActivity: string | null;
  eia: 'มี' | 'ไม่มี' | null;
  hasEia?: boolean | null;
  projectName: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  regionCode?: string | null;
  regionName?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  province: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  industrialAreaType?: 'INDUSTRIAL_ESTATE' | 'OUTSIDE_INDUSTRIAL_ESTATE';
  industrialAreaTypeLabel?: 'ในนิคมอุตสาหกรรม' | 'นอกนิคมอุตสาหกรรม';
  industrialEstateCode?: string | null;
  industrialEstateName?: string | null;
  isEligible?: boolean;
  eligibilityStatus?: 'เข้าข่าย' | 'ไม่เข้าข่าย';
  isActive?: boolean;
}

export interface FactoryGeneralDTO extends FactorySummaryDTO {
  juristicId: string | null;
  juristicName: string | null;
  industrialEstateName: string | null;
  systemId: number | null;
  systemDetail: string | null;
  verifyStatus: number | null;
  authorizeStart: string | null;
  authorizeEnd: string | null;
  operationStatus: string | null;
  capitalAmount: number | null;
  machineryHorsepower: number | null;
  productionCapacity: string | null;
  wastewaterDischargeInfo: string | null;
  boilerCount: number | null;
  boilerSizeEach: string | null;
  fuelUsed: string | null;
  hasEia: boolean | null;
  formDefaults: {
    factoryId: string;
    factoryName: string;
    factoryRegistrationNo: string;
  };
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
  connectionDueAt: string | null;
  waitingConnectionDaysRemaining: number | null;
  waitingConnectionText: string | null;
  form: string;
  status: string;
  statusCode: ConnectionRequestStatus;
  requestType: ConnectionRequestType;
}

export interface OperatorFactoryTableRowDTO {
  id: number | null;
  factoryId: string;
  factoryName: string;
  newRegistrationNo: string | null;
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
  officerNotificationEmails: string[];
  isEligible: boolean;
  eligibilityStatus: 'เข้าข่าย' | 'ไม่เข้าข่าย';
  monitoringPointCount: number;
  requestStatusCode: ConnectionRequestStatus | null;
  status: 'แสดง' | 'ซ่อน';
}

export interface OperatorFactoryDashboardRowDTO {
  id: number | null;
  factoryId: string;
  factoryName: string;
  newRegistrationNo: string;
  oldRegistrationNo: string | null;
  factoryLogoUrl: string | null;
  industryMainOrder: string | null;
  industryMainOrderLabel: string | null;
  industrySubOrder: string | null;
  eia: 'มี' | 'ไม่มี' | null;
  hasEia: boolean | null;
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  province: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  districtCode: string | null;
  districtName: string | null;
  industrialAreaType: 'INDUSTRIAL_ESTATE' | 'OUTSIDE_INDUSTRIAL_ESTATE';
  industrialAreaTypeLabel: 'ในนิคมอุตสาหกรรม' | 'นอกนิคมอุตสาหกรรม';
  industrialEstateCode: string | null;
  industrialEstateName: string | null;
  isFavorite: boolean;
  hasLatestHourlyMeasurement: boolean;
  monitoringPointCountBySystem: OperatorFactorySystemPointCountDTO[];
  status: 'แสดง';
  measurementPoints: OperatorFactoryMeasurementPointDTO[];
}

export interface OperatorFactorySystemPointCountDTO {
  systemType: ConnectionSystemType;
  count: number;
}

export interface OperatorFactoryMeasurementPointDTO {
  stationId: string | null;
  pointName: string;
  pointCode: string | null;
  systemType: ConnectionSystemType;
  parameters: string[];
  data: Record<string, unknown>[];
}

export interface PublicFactoryMapPointDTO extends Omit<
  OperatorFactoryDashboardRowDTO,
  'isFavorite' | 'hasLatestHourlyMeasurement' | 'measurementPoints'
> {
  measurementPoints: PublicFactoryMapMeasurementPointDTO[];
}

export type PublicFactoryMapMeasurementPointDTO = Omit<OperatorFactoryMeasurementPointDTO, 'data'>;

export interface CurrentFactoryMeasurementPointDTO extends OperatorFactoryMeasurementPointDTO {
  factoryId: string;
  documentsAndImages?: RequestDocumentImageInput[];
}

export interface FactoryFavoriteDTO {
  factoryId: string;
  isFavorite: boolean;
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

export interface DeviceConfigPayloadDTO {
  stationId: string;
  device: Array<{
    deviceCode: string;
    protocol: string;
    settings: Record<string, unknown>;
  }>;
  channels: Array<{
    deviceCode: string;
    addressId: number;
    dataType: string;
    valueRange?: { min: number; max: number } | null;
    alertLow?: number | null;
    alertHigh?: number | null;
    valueFormat?: string | null;
    offset: number;
    encoding?: string | null;
    status?: string | null;
  }>;
  statusManagement: DeviceConfigFormStatusManagementDTO;
}

export type DeviceConfigPayloadResponseDTO = DeviceConfigPayloadDTO | DeviceConfigPayloadDTO[];

export interface ConnectionRequestDetailDTO extends ConnectionRequestDTO {
  factory: FactorySummaryDTO | null;
  deviceConfigs: DeviceConfigPayloadDTO[];
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
  deviceConfigs: DeviceConfigPayloadDTO[];
}

export interface ConnectedMeasurementPointModalDetailDTO {
  pointCode: string | null;
  pointName: string;
  pointType: ConnectionSystemType;
  parameterDetails: string[];
  primaryFuel: string | null;
  secondaryFuel: string | null;
  instruments?: string[];
  measurementTimes?: string[];
  wastewaterSource?: string | null;
  receivingSource?: string | null;
  treatmentSystemType?: string | null;
  dischargePoint?: string | null;
  averageDischarge?: number | string | null;
  minimumDischarge?: number | string | null;
  maximumDischarge?: number | string | null;
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
  min: string;
  max: string;
  alertLow: string;
  alertHigh: string;
  valueFormat: string;
  offset: string;
  encodingData: string;
  status: string;
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
  rawConfigs: DeviceConfigPayloadDTO;
}

export interface AddParameterFormDetailDTO {
  requestType: typeof CONNECTION_REQUEST_TYPE.ADD_PARAMETER;
  sourceRequestId: number;
  sourceRequestNo: string;
  stationId: string;
  formDefaults: AddParameterRequestInput;
}

export interface PaginatedTableRowsDTO<T> {
  data: T[];
  meta: {
    total: number;
  };
}
