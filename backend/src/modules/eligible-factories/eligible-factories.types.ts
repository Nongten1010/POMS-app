export interface CoordinatesInput {
  latitude: number;
  longitude: number;
}

export interface CreateEligibleFactoryInput {
  sourceSystem?: string;
  sourceFactoryId?: string | null;
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
  hasEia?: boolean | null;
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
  eia?: 'มี' | 'ไม่มี' | null;
  hasEia: boolean | null;
}

export interface BoilerLookupValue {
  boilerSizeEach: string | null;
  fuelUsed: string | null;
}

export interface SelectedEligibleFactoryDTO extends EligibleFactoryCandidateDTO {
  id: number;
}

export interface EligibleFactoryDTO {
  id: number;
  sourceSystem: string;
  sourceFactoryId: string | null;
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
  hasEia: boolean | null;
  selectedReason: string | null;
  selectedBy: number;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
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
