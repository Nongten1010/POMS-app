import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import type {
  CreateAnyPomsFactoryEditRequestInput,
  ListPomsFactoryEditRequestsQuery,
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryReviewActorContext,
  PomsFactoryProfileDTO,
  PomsMeasurementPointDTO,
  PomsFactorySummaryDTO,
  ResubmitPomsFactoryEditRequestInput,
  ReviewPomsFactoryEditRequestInput,
} from './poms-factories.types';
import {
  POMS_FACTORY_EDIT_REQUEST_FORM_TYPE,
  POMS_FACTORY_EDIT_REQUEST_STATUS,
} from './poms-factories.types';
import { pomsFactoriesRepository } from './poms-factories.repository';

type AccessScope = string | null | undefined | PermissionScopeDetails;

export const pomsFactoriesService = {
  async listFactories(
    actorUserId: number,
    viewScope: AccessScope,
    search?: string,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<{ data: PomsFactorySummaryDTO[]; meta: { total: number } }> {
    const data = await pomsFactoriesRepository.listFactories(
      { actorUserId, scope: viewScope, regionalAccess },
      search,
    );
    return { data, meta: { total: data.length } };
  },

  async getFactoryDetail(
    factoryId: string,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryDetailDTO> {
    const detail = await pomsFactoriesRepository.findFactoryDetail(factoryId, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    if (!detail) throw new NotFoundError('POMS factory not found');
    return detail;
  },

  async createEditRequest(
    factoryId: string,
    input: CreateAnyPomsFactoryEditRequestInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    const current = await this.getFactoryDetail(factoryId, actorUserId, viewScope, regionalAccess);
    const requestedFormType = isMeasurementPointsRequest(input)
      ? POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
      : POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO;
    const openRequest = await pomsFactoriesRepository.findOpenEditRequestForFactory(
      current.eligibleFactoryId,
      requestedFormType,
    );
    if (openRequest) {
      throw new ConflictError('Factory already has an open POMS edit request', {
        requestId: openRequest.id,
        status: openRequest.status,
      });
    }

    if (isMeasurementPointsRequest(input)) {
      const proposed = buildProposedMeasurementPoints(current.measurementPoints, input);
      ensureMeasurementPointsChanged(current.measurementPoints, proposed);
      return pomsFactoriesRepository.createEditRequest(
        current,
        {
          formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS,
          proposedFactory: toProfileSnapshot(current),
          proposedMeasurementPoints: proposed,
        },
        input.note ?? null,
        actorUserId,
      );
    }

    const proposed = buildProposedProfile(current, input);
    ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.createEditRequest(
      current,
      {
        formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO,
        proposedFactory: proposed,
        proposedMeasurementPoints: null,
      },
      input.note ?? null,
      actorUserId,
    );
  },

  async listEditRequests(
    query: ListPomsFactoryEditRequestsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<{ data: PomsFactoryEditRequestDTO[]; meta: { total: number } }> {
    const data = await pomsFactoriesRepository.listEditRequests(query, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    return { data, meta: { total: data.length } };
  },

  async getEditRequest(
    id: number,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    const request = await pomsFactoriesRepository.findEditRequestById(id, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    if (!request) throw new NotFoundError('POMS factory edit request not found');
    return request;
  },

  async resubmitEditRequest(
    id: number,
    input: ResubmitPomsFactoryEditRequestInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    const request = await this.getEditRequest(id, actorUserId, viewScope, regionalAccess);
    if (request.status !== POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED) {
      throw new ConflictError(
        'POMS factory edit request cannot be resubmitted from its current status',
        {
          currentStatus: request.status,
          allowedStatuses: [POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED],
        },
      );
    }

    const current = await this.getFactoryDetail(
      request.factoryId,
      actorUserId,
      viewScope,
      regionalAccess,
    );

    if (isMeasurementPointsRequest(input)) {
      if (request.formType !== POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS) {
        throw new ConflictError(
          'POMS factory edit request form type cannot change on resubmission',
        );
      }
      const proposed = buildProposedMeasurementPoints(current.measurementPoints, input);
      ensureMeasurementPointsChanged(current.measurementPoints, proposed);
      return pomsFactoriesRepository.resubmitEditRequest(
        id,
        {
          formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS,
          proposedFactory: toProfileSnapshot(current),
          proposedMeasurementPoints: proposed,
        },
        input.note ?? null,
        actorUserId,
      );
    }

    if (request.formType !== POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO) {
      throw new ConflictError('POMS factory edit request form type cannot change on resubmission');
    }
    const proposed = buildProposedProfile(current, input);
    ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.resubmitEditRequest(
      id,
      {
        formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO,
        proposedFactory: proposed,
        proposedMeasurementPoints: null,
      },
      input.note ?? null,
      actorUserId,
    );
  },

  async reviewEditRequest(
    id: number,
    input: ReviewPomsFactoryEditRequestInput,
    actorUserId: number,
    actor: PomsFactoryReviewActorContext,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    ensureAdminReviewActor(actor);
    const request = await this.getEditRequest(id, actorUserId, viewScope, regionalAccess);
    if (
      request.status !== POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW &&
      request.status !== POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW
    ) {
      throw new ConflictError(
        'POMS factory edit request cannot be reviewed from its current status',
        {
          currentStatus: request.status,
          allowedStatuses: [
            POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
            POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW,
          ],
        },
      );
    }
    if (request.createdBy === actorUserId || request.submittedBy === actorUserId) {
      throw new ForbiddenError(
        'The request creator or latest submitter cannot review their own POMS factory edit request',
      );
    }
    return pomsFactoriesRepository.reviewEditRequest(id, input, actorUserId);
  },
};

function buildProposedProfile(
  current: PomsFactoryProfileDTO,
  input: Exclude<CreateAnyPomsFactoryEditRequestInput, { formType: 'MEASUREMENT_POINTS' }>,
): PomsFactoryProfileDTO {
  const proposed: PomsFactoryProfileDTO = {
    ...toProfileSnapshot(current),
    factoryName: input.factoryName,
    factoryAddress: patchValue(input, 'factoryAddress', current.factoryAddress),
    latitude: patchValue(input, 'latitude', current.latitude),
    longitude: patchValue(input, 'longitude', current.longitude),
    eia: patchValue(input, 'eia', current.eia),
    projectName: patchValue(input, 'projectName', current.projectName),
    factoryFrontPhotos: patchValue(input, 'factoryFrontPhotos', current.factoryFrontPhotos),
    factoryLogo: patchValue(input, 'factoryLogo', current.factoryLogo),
  };

  if (Object.prototype.hasOwnProperty.call(input, 'eia')) {
    proposed.eiaOther = input.eia === 'อื่นๆ' ? (input.eiaOther ?? null) : null;
  }
  return proposed;
}

function toProfileSnapshot(factory: PomsFactoryProfileDTO): PomsFactoryProfileDTO {
  return {
    eligibleFactoryId: factory.eligibleFactoryId,
    factoryId: factory.factoryId,
    factoryRegistrationNo: factory.factoryRegistrationNo,
    factoryName: factory.factoryName,
    factoryAddress: factory.factoryAddress,
    provinceName: factory.provinceName,
    industrialEstateName: factory.industrialEstateName,
    latitude: factory.latitude,
    longitude: factory.longitude,
    eia: factory.eia,
    eiaOther: factory.eiaOther,
    projectName: factory.projectName,
    factoryFrontPhotos: factory.factoryFrontPhotos,
    factoryLogo: factory.factoryLogo,
    updatedAt: factory.updatedAt,
  };
}

function patchValue<T>(
  input: Exclude<CreateAnyPomsFactoryEditRequestInput, { formType: 'MEASUREMENT_POINTS' }>,
  key: keyof Exclude<CreateAnyPomsFactoryEditRequestInput, { formType: 'MEASUREMENT_POINTS' }>,
  current: T,
): T {
  return Object.prototype.hasOwnProperty.call(input, key) ? ((input[key] ?? null) as T) : current;
}

function ensureProfileChanged(
  current: PomsFactoryProfileDTO,
  proposed: PomsFactoryProfileDTO,
): void {
  if (JSON.stringify(editableProfile(current)) === JSON.stringify(editableProfile(proposed))) {
    throw new ConflictError('POMS factory edit request does not contain any changes');
  }
}

function editableProfile(profile: PomsFactoryProfileDTO) {
  return {
    factoryName: profile.factoryName,
    factoryAddress: profile.factoryAddress,
    latitude: profile.latitude,
    longitude: profile.longitude,
    eia: profile.eia,
    eiaOther: profile.eiaOther,
    projectName: profile.projectName,
    factoryFrontPhotos: profile.factoryFrontPhotos,
    factoryLogo: profile.factoryLogo,
  };
}

function isMeasurementPointsRequest(
  input: CreateAnyPomsFactoryEditRequestInput,
): input is Extract<CreateAnyPomsFactoryEditRequestInput, { formType: 'MEASUREMENT_POINTS' }> {
  return input.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS;
}

function buildProposedMeasurementPoints(
  currentPoints: PomsMeasurementPointDTO[],
  input: Extract<CreateAnyPomsFactoryEditRequestInput, { formType: 'MEASUREMENT_POINTS' }>,
): PomsMeasurementPointDTO[] {
  const patchById = new Map(
    input.measurementPoints.map((point) => [point.connectedPointId, point]),
  );

  for (const pointId of patchById.keys()) {
    if (currentPoints.some((point) => point.connectedPointId === pointId)) continue;
    throw new NotFoundError(`POMS measurement point ${pointId} not found for this factory`);
  }

  return currentPoints.map((point) => {
    const patch = patchById.get(point.connectedPointId);
    if (!patch) return point;

    const measurementInstruments = Object.prototype.hasOwnProperty.call(
      patch,
      'measurementInstruments',
    )
      ? (patch.measurementInstruments ?? null)
      : point.measurementInstruments;
    const details = Object.prototype.hasOwnProperty.call(patch, 'details')
      ? (patch.details ?? null)
      : point.details;

    return {
      ...point,
      pointName: patch.pointName === undefined ? point.pointName : patch.pointName,
      monitoringPointStatus: Object.prototype.hasOwnProperty.call(patch, 'monitoringPointStatus')
        ? (patch.monitoringPointStatus ?? null)
        : point.monitoringPointStatus,
      details,
      documentsAndImages: Object.prototype.hasOwnProperty.call(patch, 'documentsAndImages')
        ? (patch.documentsAndImages ?? [])
        : point.documentsAndImages,
      measurementInstruments,
    };
  });
}

function ensureMeasurementPointsChanged(
  currentPoints: PomsMeasurementPointDTO[],
  proposedPoints: PomsMeasurementPointDTO[],
): void {
  if (
    JSON.stringify(currentPoints.map(editableMeasurementPoint)) ===
    JSON.stringify(proposedPoints.map(editableMeasurementPoint))
  ) {
    throw new ConflictError('POMS factory edit request does not contain any changes');
  }
}

function editableMeasurementPoint(point: PomsMeasurementPointDTO) {
  return {
    connectedPointId: point.connectedPointId,
    pointName: point.pointName,
    monitoringPointStatus: point.monitoringPointStatus,
    details: point.details,
    documentsAndImages: point.documentsAndImages,
    measurementInstruments: point.measurementInstruments,
  };
}

function ensureAdminReviewActor(actor: PomsFactoryReviewActorContext): void {
  if (actor.userType === 'admin' && actor.roles.includes('admin')) return;
  throw new ForbiddenError('POMS factory edit request review is limited to admin users');
}
