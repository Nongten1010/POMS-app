export const MONITORING_POINT_SYSTEM_TYPES = ['CEMS', 'WPMS'] as const;

export const MONITORING_POINT_STATUSES = [
  'เชื่อมต่อครบแล้ว',
  'ได้รับการยกเว้นทั้งหมด',
  'เชื่อมต่อแล้วแต่ยังไม่ครบ',
  'อยู่ระหว่างขยายเวลา',
  'ยังไม่ได้ดำเนินการเชื่อมต่อ',
  'อยู่ระหว่างการตรวจสอบของจังหวัด',
  'อยู่ระหว่างเชื่อมต่อ',
] as const;

export type MonitoringPointSystemType = (typeof MONITORING_POINT_SYSTEM_TYPES)[number];
export type MonitoringPointStatus = (typeof MONITORING_POINT_STATUSES)[number];

export interface MonitoringPointFormFactoryInput {
  factoryName?: string | null;
  factoryRegistrationNoNew?: string | null;
  factoryRegistrationNoOld?: string | null;
  provinceName?: string | null;
  factoryTypeMain?: string | null;
  factoryTypeSub?: string | null;
  operationStatus?: string | null;
  eiaInfo?: string | null;
  eiaOther?: string | null;
  projectName?: string | null;
  address?: string | null;
  businessActivity?: string | null;
  machineryHorsepower?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MonitoringPointInput {
  id?: number;
  systemType: MonitoringPointSystemType;
  pointCode?: string | null;
  pointName?: string | null;
  productionUnitType?: string | null;
  productionCapacity?: string | null;
  cemsInstallationRequiredBy?: string | null;
  cemsInstallationRequiredOther?: string | null;
  legalAnnexNo?: string[];
  accountingConnectionStatus?: string | null;
  eligibleParameters?: string[];
  exemptedParameters?: string[];
  connectedParameters?: string[];
  pendingParameters?: string[];
  timeSharingParameters?: string[];
  sharedStackCode?: string | null;
  monitoringPointStatus?: MonitoringPointStatus | null;
  primaryFuel?: string | null;
  primaryFuelOther?: string | null;
  secondaryFuel?: string | null;
  secondaryFuelOther?: string | null;
  details?: Record<string, unknown> | null;
}

export interface SaveMonitoringPointFormInput {
  factory: MonitoringPointFormFactoryInput;
  points: MonitoringPointInput[];
}

export interface MonitoringPointDTO extends Required<
  Omit<
    MonitoringPointInput,
    'id' | 'details' | 'timeSharingParameters' | 'sharedStackCode' | 'monitoringPointStatus'
  >
> {
  id: number;
  formId: number;
  timeSharingParameters?: string[];
  sharedStackCode?: string | null;
  monitoringPointStatus?: MonitoringPointStatus | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringPointFormDTO {
  id: number;
  factory: Required<MonitoringPointFormFactoryInput>;
  points: MonitoringPointDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringPointFormSummaryDTO {
  id: number;
  factory: Required<MonitoringPointFormFactoryInput>;
  pointCount: number;
  cemsPointCount: number;
  wpmsPointCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListMonitoringPointFormsQuery {
  factoryRegistrationNoNew?: string;
  systemType?: MonitoringPointSystemType;
}
