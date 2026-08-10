import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type { EligibleFactoryAccessContext } from './eligible-factories.access';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  ListEligibleFactoryCandidatesQuery,
  ListEligibleFactoriesQuery,
  PaginatedEligibleFactoriesDTO,
  SelectedEligibleFactoryDTO,
} from './eligible-factories.types';
import { eligibleFactoryCandidatesRepository } from './eligible-factory-candidates.repository';
import { resolveEligibleFactoryAddressForStorage } from './eligible-factory-source-hydration';
import { deriveConnectionStatusSummary } from './eligible-factory-status-summary';
import { splitFactoryTypeSequence } from './factory-type-sequence';

export const eligibleFactoriesService = {
  listCandidates(
    query: ListEligibleFactoryCandidatesQuery,
    access?: EligibleFactoryAccessContext,
  ) {
    return eligibleFactoryCandidatesRepository.list(query, access);
  },

  async list(
    query: ListEligibleFactoriesQuery,
    access?: EligibleFactoryAccessContext,
  ): Promise<PaginatedEligibleFactoriesDTO> {
    const { rows, total } = await eligibleFactoriesRepository.list(query, access);
    return { data: rows.map(toSelectedEligibleFactory), meta: { total } };
  },

  async create(
    input: CreateEligibleFactoryInput,
    actorUserId: number,
    access?: EligibleFactoryAccessContext,
  ): Promise<EligibleFactoryDTO> {
    if (access) {
      const canAccessInput = await eligibleFactoriesRepository.canAccessInput(input, access);
      if (!canAccessInput) {
        throw new ForbiddenError('Eligible factory is outside the actor access scope');
      }
    }

    const existing = await eligibleFactoriesRepository.findByRegistrationNoNew(
      input.factoryRegistrationNoNew,
    );
    if (existing) {
      throw new ConflictError('Factory is already selected as eligible', {
        factoryRegistrationNoNew: input.factoryRegistrationNoNew,
      });
    }

    const resolvedAddress = await resolveEligibleFactoryAddressForStorage({
      sourceFactoryId: input.sourceFactoryId ?? null,
      factoryRegistrationNoNew: input.factoryRegistrationNoNew,
      address: input.address,
      provinceName: input.provinceName,
    });
    const normalizedInput =
      resolvedAddress === undefined && input.address === undefined
        ? input
        : { ...input, address: resolvedAddress };

    return eligibleFactoriesRepository.create(normalizedInput, actorUserId);
  },

  async remove(
    id: number,
    actorUserId: number,
    access?: EligibleFactoryAccessContext,
  ): Promise<void> {
    const removed = access
      ? await eligibleFactoriesRepository.softDeleteAccessible(id, actorUserId, access)
      : await eligibleFactoriesRepository.softDelete(id, actorUserId);
    if (!removed) {
      throw new NotFoundError('Eligible factory selection not found');
    }
  },
};

function toSelectedEligibleFactory(factory: EligibleFactoryDTO): SelectedEligibleFactoryDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(factory.factoryTypeSequence);
  const measurementPoints = factory.measurementPoints ?? [];

  return {
    id: factory.id,
    monitoringPointFormId: factory.monitoringPointFormId,
    factoryName: factory.factoryName,
    factoryId: factory.factoryRegistrationNoNew,
    factoryRegistrationNo: factory.factoryRegistrationNoOld ?? factory.factoryRegistrationNoNew,
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
    eia: factory.eia ?? null,
    eiaOther: factory.eiaOther ?? null,
    hasEia: factory.hasEia,
    projectName: factory.projectName ?? null,
    cemsConnectionStatusSummary: deriveConnectionStatusSummary(measurementPoints, 'CEMS'),
    wpmsConnectionStatusSummary: deriveConnectionStatusSummary(measurementPoints, 'WPMS'),
    measurementPoints,
  };
}
