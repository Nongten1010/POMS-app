import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { connectionRequestsRepository } from '../connection-requests/connection-requests.repository';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type { EligibleFactoryAccessContext } from './eligible-factories.access';
import type {
  CreateEligibleFactoryAddRequestInput,
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  EligibleFactoryAddRequestDTO,
  ListEligibleFactoryCandidatesQuery,
  ListEligibleFactoryAddRequestsQuery,
  ListEligibleFactoriesQuery,
  PaginatedEligibleFactoriesDTO,
  PaginatedEligibleFactoryAddRequestsDTO,
  ReviewEligibleFactoryAddRequestInput,
  SelectedEligibleFactoryDTO,
} from './eligible-factories.types';
import { eligibleFactoryCandidatesRepository } from './eligible-factory-candidates.repository';
import { resolveEligibleFactoryAddressForStorage } from './eligible-factory-source-hydration';
import { deriveConnectionStatusSummary } from './eligible-factory-status-summary';
import { splitFactoryTypeSequence } from './factory-type-sequence';
import { isMssqlUniqueConstraintError } from './eligible-factory-add-request-errors';

export const eligibleFactoriesService = {
  listCandidates(query: ListEligibleFactoryCandidatesQuery, access?: EligibleFactoryAccessContext) {
    return eligibleFactoryCandidatesRepository.list(query, access);
  },

  async list(
    query: ListEligibleFactoriesQuery,
    access?: EligibleFactoryAccessContext,
  ): Promise<PaginatedEligibleFactoriesDTO> {
    const { rows, total } = await eligibleFactoriesRepository.list(query, access);
    return { data: rows.map(toSelectedEligibleFactory), meta: { total } };
  },

  async listAddRequests(
    query: ListEligibleFactoryAddRequestsQuery,
    access?: EligibleFactoryAccessContext,
  ): Promise<PaginatedEligibleFactoryAddRequestsDTO> {
    const { rows, total } = await eligibleFactoriesRepository.listAddRequests(query, access);
    return {
      data: rows,
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.perPage),
      },
    };
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

  async createAddRequest(
    input: CreateEligibleFactoryAddRequestInput,
    actorUserId: number,
    access: {
      view: EligibleFactoryAccessContext;
      edit: EligibleFactoryAccessContext;
    },
  ): Promise<EligibleFactoryAddRequestDTO> {
    const [visibleFactory, editableFactory] = await Promise.all([
      connectionRequestsRepository.findFactorySummaryForAccess(input.factoryId, access.view),
      connectionRequestsRepository.findFactorySummaryForAccess(input.factoryId, access.edit),
    ]);
    if (
      !visibleFactory ||
      !editableFactory ||
      visibleFactory.id === null ||
      editableFactory.id === null ||
      visibleFactory.id !== editableFactory.id
    ) {
      throw new NotFoundError('Factory not found for this user');
    }

    const factory = editableFactory;
    const factoryMasterId = Number(factory.id);
    if (!Number.isSafeInteger(factoryMasterId) || factoryMasterId < 1) {
      throw new NotFoundError('Factory not found for this user');
    }
    const general = await connectionRequestsRepository.findFactoryGeneral(
      input.factoryId,
      access.edit,
    );
    const factoryDetails = general?.id === factoryMasterId ? general : null;
    if (factory.isEligible || general?.isEligible) {
      throw new ConflictError('Factory is already selected as eligible', {
        factoryRegistrationNoNew: factory.newRegistrationNo,
      });
    }
    const selected = await eligibleFactoriesRepository.findByRegistrationNoNew(
      factory.newRegistrationNo,
    );
    if (selected) {
      throw new ConflictError('Factory is already selected as eligible', {
        factoryRegistrationNoNew: factory.newRegistrationNo,
      });
    }

    const existing =
      await eligibleFactoriesRepository.findOpenAddRequestByFactoryMasterId(factoryMasterId);
    if (existing) {
      throw new ConflictError('Factory already has a pending add-factory request', {
        requestId: existing.id,
      });
    }

    const provinceName = factory.provinceName ?? factory.province ?? 'ไม่ระบุจังหวัด';
    const requestedFactory: CreateEligibleFactoryInput = {
      sourceSystem: 'eligible_factory_add_requests',
      sourceFactoryId: factory.factoryId,
      factoryName: factory.factoryName,
      factoryRegistrationNoNew: factory.newRegistrationNo,
      factoryRegistrationNoOld: factory.oldRegistrationNo,
      factoryTypeSequence: joinFactoryTypeSequenceForRequest(factory),
      address: factoryDetails?.address ?? factory.address,
      provinceName,
      industrialEstateName:
        factoryDetails?.industrialEstateName ?? factory.industrialEstateName ?? null,
      coordinates: toCoordinates(
        factoryDetails?.latitude ?? factory.latitude,
        factoryDetails?.longitude ?? factory.longitude,
      ),
      businessActivity: factoryDetails?.businessActivity ?? factory.businessActivity ?? null,
      operationStatus:
        factoryDetails?.operationStatus ?? deriveFactoryOperationStatus(factory.isActive),
      capitalAmount: factoryDetails?.capitalAmount ?? null,
      machineryHorsepower: factoryDetails?.machineryHorsepower ?? null,
      productionCapacity: factoryDetails?.productionCapacity ?? null,
      wastewaterDischargeInfo: factoryDetails?.wastewaterDischargeInfo ?? null,
      boilerCount: factoryDetails?.boilerCount ?? null,
      boilerSizeEach: factoryDetails?.boilerSizeEach ?? null,
      fuelUsed: factoryDetails?.fuelUsed ?? null,
      eia: factoryDetails?.eia ?? factory.eia ?? null,
      eiaOther: null,
      hasEia: factoryDetails?.hasEia ?? factory.hasEia ?? null,
      projectName: factoryDetails?.projectName ?? factory.projectName ?? null,
      selectedReason: input.reason,
    };

    try {
      return await eligibleFactoriesRepository.createAddRequest(
        {
          factoryMasterId,
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          factoryRegistrationNo: factory.newRegistrationNo,
          provinceName,
          reason: input.reason,
          requestedFactory,
        },
        actorUserId,
      );
    } catch (error) {
      if (isMssqlUniqueConstraintError(error)) {
        throw new ConflictError('Factory already has a pending add-factory request');
      }
      throw error;
    }
  },

  async reviewAddRequest(
    requestId: number,
    input: ReviewEligibleFactoryAddRequestInput,
    actorUserId: number,
    access: {
      view: EligibleFactoryAccessContext;
      approve: EligibleFactoryAccessContext;
    },
  ): Promise<EligibleFactoryAddRequestDTO> {
    const reviewed = await eligibleFactoriesRepository.reviewAddRequest(
      requestId,
      input,
      actorUserId,
      [access.view, access.approve],
    );
    if (!reviewed) throw new NotFoundError('Eligible factory add request not found');
    return reviewed;
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

function joinFactoryTypeSequenceForRequest(factory: {
  industryMainOrder?: string | null;
  industrySubOrder?: string | null;
}): string | null {
  const main =
    typeof factory.industryMainOrder === 'string' ? factory.industryMainOrder.trim() : '';
  const sub = typeof factory.industrySubOrder === 'string' ? factory.industrySubOrder.trim() : '';
  if (main === 'ไม่ระบุ' || sub === 'ไม่ระบุ') return null;
  if (!main && !sub) return null;
  if (!sub) return main;
  return `${main.padStart(5, '0')} / ${sub.padStart(4, '0')}`;
}

function toCoordinates(
  latitudeValue: string | null,
  longitudeValue: string | null,
): CreateEligibleFactoryInput['coordinates'] {
  if (latitudeValue === null || longitudeValue === null) return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function deriveFactoryOperationStatus(isActive: boolean | undefined): string {
  if (isActive === true) return 'เปิดดำเนินการ';
  if (isActive === false) return 'ปิดดำเนินการ';
  return 'ไม่ระบุสถานะ';
}

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
