import type { ConnectionRequestEiaAssessment } from '../connection-requests/connection-request-eia';

export interface CoordinatesInput {
  latitude: number;
  longitude: number;
}

export interface CreateEligibleFactoryInput {
  sourceSystem?: string;
  sourceFactoryId?: string | null;
  monitoringPointFormId?: number | null;
  factoryName: string;
  factoryRegistrationNoNew: string;
  factoryRegistrationNoOld?: string | null;
  factoryTypeSequence?: string | null;
  address?: string | null;
  provinceName: string;
  industrialEstateName?: string | null;
  coordinates?: CoordinatesInput | null;
  businessActivity?: string | null;
  operationStatus: string;
  capitalAmount?: number | null;
  machineryHorsepower?: number | null;
  productionCapacity?: string | null;
  wastewaterDischargeInfo?: string | null;
  boilerCount?: number | null;
  boilerSizeEach?: string | null;
  fuelUsed?: string | null;
  eia?: ConnectionRequestEiaAssessment | null;
  eiaOther?: string | null;
  hasEia?: boolean | null;
  projectName?: string | null;
  selectedReason?: string | null;
}

export type ListEligibleFactoriesQuery = Record<string, never>;

export interface ListEligibleFactoryCandidatesQuery {
  page?: number;
  perPage?: number;
}

export interface EligibleFactoryCandidateDTO {
  factoryName: string;
  factoryId: string;
  factoryRegistrationNo: string;
  factoryClass: string | null;
  factorySubclass: string | null;
  address: string | null;
  provinceName: string;
  industrialEstateName: string | null;
  longitude: number | null;
  latitude: number | null;
  businessActivity: string | null;
  operationStatus: string;
  capitalAmount?: number | null;
  machineryHorsepower: number | null;
  productionCapacity: string | null;
  wastewaterDischargeInfo?: string | null;
  boilerCount?: number | null;
  boilerSizeEach: string | null;
  fuelUsed: string | null;
  eia?: ConnectionRequestEiaAssessment | null;
  eiaOther?: string | null;
  projectName?: string | null;
  hasEia: boolean | null;
}

export interface BoilerLookupValue {
  boilerSizeEach: string | null;
  fuelUsed: string | null;
}

export interface SelectedEligibleFactoryDTO extends EligibleFactoryCandidateDTO {
  id: number;
  monitoringPointFormId?: number | null;
  measurementPoints?: EligibleFactoryMeasurementPointDTO[];
}

export interface EligibleFactoryMeasurementPointDTO {
  systemType: 'CEMS' | 'WPMS';
  pointCode: string | null;
  pointName: string | null;
  productionUnitType: string | null;
  productionCapacity: string | null;
  cemsInstallationRequiredBy: string | null;
  cemsInstallationRequiredOther: string | null;
  legalAnnexNo: string[];
  accountingConnectionStatus: string | null;
  eligibleParameters: string[];
  exemptedParameters: string[];
  connectedParameters: string[];
  pendingParameters: string[];
  primaryFuel: string | null;
  primaryFuelOther: string | null;
  secondaryFuel: string | null;
  secondaryFuelOther: string | null;
  details: Record<string, unknown> | null;
}

export interface EligibleFactoryDTO {
  id: number;
  sourceSystem: string;
  sourceFactoryId: string | null;
  monitoringPointFormId: number | null;
  factoryRegistrationNoNew: string;
  factoryRegistrationNoOld: string | null;
  factoryName: string;
  factoryTypeSequence: string | null;
  address: string | null;
  provinceName: string;
  industrialEstateName: string | null;
  coordinates: CoordinatesInput | null;
  businessActivity: string | null;
  operationStatus: string;
  capitalAmount: number | null;
  machineryHorsepower: number | null;
  productionCapacity: string | null;
  wastewaterDischargeInfo: string | null;
  boilerCount: number | null;
  boilerSizeEach: string | null;
  fuelUsed: string | null;
  eia?: ConnectionRequestEiaAssessment | null;
  eiaOther?: string | null;
  hasEia: boolean | null;
  projectName?: string | null;
  selectedReason: string | null;
  selectedBy: number;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
  measurementPoints?: EligibleFactoryMeasurementPointDTO[];
}

export interface PaginatedEligibleFactoriesDTO {
  data: SelectedEligibleFactoryDTO[];
  meta: {
    total: number;
  };
}

export interface EligibleFactoryCandidatesDTO {
  data: EligibleFactoryCandidateDTO[];
  meta: {
    total: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
    source: 'external';
  };
}
