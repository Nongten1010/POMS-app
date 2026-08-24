import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import type {
  CreatePomsFactoryEditRequestInput,
  ListPomsFactoryEditRequestsQuery,
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryProfileDTO,
  PomsFactorySummaryDTO,
  ResubmitPomsFactoryEditRequestInput,
  ReviewPomsFactoryEditRequestInput,
} from './poms-factories.types';
import { POMS_FACTORY_EDIT_REQUEST_STATUS } from './poms-factories.types';
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
    input: CreatePomsFactoryEditRequestInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    const current = await this.getFactoryDetail(factoryId, actorUserId, viewScope, regionalAccess);
    const openRequest = await pomsFactoriesRepository.findOpenEditRequestForFactory(
      current.eligibleFactoryId,
    );
    if (openRequest) {
      throw new ConflictError('Factory already has an open POMS edit request', {
        requestId: openRequest.id,
        status: openRequest.status,
      });
    }

    const proposed = buildProposedProfile(current, input);
    ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.createEditRequest(
      current,
      proposed,
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
    const proposed = buildProposedProfile(current, input);
    ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.resubmitEditRequest(
      id,
      proposed,
      input.note ?? null,
      actorUserId,
    );
  },

  async reviewEditRequest(
    id: number,
    input: ReviewPomsFactoryEditRequestInput,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
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
  input: CreatePomsFactoryEditRequestInput,
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
  input: CreatePomsFactoryEditRequestInput,
  key: keyof CreatePomsFactoryEditRequestInput,
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
