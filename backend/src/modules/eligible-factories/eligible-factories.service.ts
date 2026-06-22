import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryCandidateDTO,
  EligibleFactoryDTO,
  ListEligibleFactoryCandidatesQuery,
  ListEligibleFactoriesQuery,
  PaginatedEligibleFactoriesDTO,
  SelectedEligibleFactoryDTO,
} from './eligible-factories.types';
import { eligibleFactoryCandidatesRepository } from './eligible-factory-candidates.repository';

export const eligibleFactoriesService = {
  listCandidates(query: ListEligibleFactoryCandidatesQuery) {
    return eligibleFactoryCandidatesRepository.list(query);
  },

  async list(query: ListEligibleFactoriesQuery): Promise<PaginatedEligibleFactoriesDTO> {
    const { rows, total } = await eligibleFactoriesRepository.list(query);
    return { data: rows.map(toSelectedEligibleFactory), meta: { total } };
  },

  async create(
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO> {
    const existing = await eligibleFactoriesRepository.findByRegistrationNoNew(
      input.factoryRegistrationNoNew,
    );
    if (existing) {
      throw new ConflictError('Factory is already selected as eligible', {
        factoryRegistrationNoNew: input.factoryRegistrationNoNew,
      });
    }

    return eligibleFactoriesRepository.create(input, actorUserId);
  },

  async remove(id: number, actorUserId: number): Promise<void> {
    const removed = await eligibleFactoriesRepository.softDelete(id, actorUserId);
    if (!removed) {
      throw new NotFoundError('Eligible factory selection not found');
    }
  },
};

function toSelectedEligibleFactory(factory: EligibleFactoryDTO): SelectedEligibleFactoryDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(factory.factoryTypeSequence);

  return {
    id: factory.id,
    monitoringPointFormId: factory.monitoringPointFormId,
    factoryName: factory.factoryName,
    factoryId: factory.sourceFactoryId ?? factory.factoryRegistrationNoNew,
    factoryRegistrationNo: factory.factoryRegistrationNoNew,
    factoryClass,
    factorySubclass,
    address: factory.address,
    provinceName: factory.provinceName,
    industrialEstateName: factory.industrialEstateName,
    longitude: factory.coordinates?.longitude ?? null,
    latitude: factory.coordinates?.latitude ?? null,
    businessActivity: factory.businessActivity,
    operationStatus: factory.operationStatus,
    capitalAmount: factory.capitalAmount,
    machineryHorsepower: factory.machineryHorsepower,
    productionCapacity: factory.productionCapacity,
    wastewaterDischargeInfo: factory.wastewaterDischargeInfo,
    boilerCount: factory.boilerCount,
    boilerSizeEach: factory.boilerSizeEach,
    fuelUsed: factory.fuelUsed,
    hasEia: factory.hasEia,
  };
}

function splitFactoryTypeSequence(
  value: string | null,
): Pick<EligibleFactoryCandidateDTO, 'factoryClass' | 'factorySubclass'> {
  if (!value) return { factoryClass: null, factorySubclass: null };
  const [factoryClass, factorySubclass] = value.split(' / ', 2);

  return {
    factoryClass: factoryClass || null,
    factorySubclass: factorySubclass || null,
  };
}
