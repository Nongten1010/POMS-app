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

export interface ListEligibleFactoriesQuery {
  page?: number;
  perPage?: number;
  search?: string;
  provinceName?: string;
  operationStatus?: string;
  hasEia?: boolean;
}

export interface ListEligibleFactoryCandidatesQuery {
  page?: number;
  perPage?: number;
  search?: string;
  provinceName?: string;
  operationStatus?: string;
  hasEia?: boolean;
}

export interface EligibleFactoryCandidateDTO extends CreateEligibleFactoryInput {
  sourceSystem: string;
  sourceFactoryId: string;
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
  data: EligibleFactoryDTO[];
  meta: {
    total: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };
}

export interface EligibleFactoryCandidatesDTO {
  data: EligibleFactoryCandidateDTO[];
  meta: {
    total: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
    source: 'mock';
  };
}
