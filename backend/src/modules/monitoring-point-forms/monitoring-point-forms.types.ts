export const MONITORING_POINT_SYSTEM_TYPES = ['CEMS', 'WPMS'] as const;

export type MonitoringPointSystemType = (typeof MONITORING_POINT_SYSTEM_TYPES)[number];

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

export interface MonitoringPointDTO extends Required<Omit<MonitoringPointInput, 'id' | 'details'>> {
  id: number;
  formId: number;
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
