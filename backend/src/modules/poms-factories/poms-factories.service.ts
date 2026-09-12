import { contactSnapshot, contactsChanged } from './poms-factory-contacts';
import { isCanonicalFactoryProfilesEnabled } from '../factory-profiles/factory-profile-mode';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { deriveHasEiaFromAssessment } from '../connection-requests/connection-request-eia';
import {
  CONNECTION_REQUEST_TYPE,
  type ConnectionRequestFormDTO,
  type ConnectionSystemType,
  type OperatorFactoryTableRowDTO,
  type RequestDocumentImageInput,
} from '../connection-requests/connection-requests.types';
import type {
  CreateAnyPomsFactoryEditRequestInput,
  ListPomsFactoryEditRequestsQuery,
  PomsFactoryDetailDTO,
  PomsFactoryFormContactsDTO,
  PomsFactoryEditRequestDetailDTO,
  PomsFactoryEditRequestDTO,
  PomsFactoryReviewActorContext,
  PomsFactoryProfileDTO,
  PomsFactoryProfilePatchInput,
  PomsMeasurementPointDTO,
  ResubmitPomsFactoryEditRequestInput,
  ReviewPomsFactoryEditRequestInput,
} from './poms-factories.types';
import {
  CANCELLABLE_POMS_FACTORY_EDIT_REQUEST_STATUSES,
  POMS_FACTORY_EDIT_REQUEST_FORM_TYPE,
  POMS_FACTORY_EDIT_REQUEST_STATUS,
} from './poms-factories.types';
import {
  requestedPointParameters,
  alignPointInstruments,
} from './poms-measurement-point-parameters';
import { pomsFactoriesRepository } from './poms-factories.repository';

type AccessScope = string | null | undefined | PermissionScopeDetails;

export const pomsFactoriesService = {
  async listFactories(
    actorUserId: number,
    viewScope: AccessScope,
    search?: string,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<{ data: OperatorFactoryTableRowDTO[]; meta: { total: number } }> {
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

  async getFactoryForm(
    factoryId: string,
    actorUserId: number,
    viewScope: AccessScope,
    query: { formType?: PomsFactoryEditRequestDTO['formType']; systemType?: ConnectionSystemType },
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestFormDTO> {
    const current = await this.getFactoryDetail(factoryId, actorUserId, viewScope, regionalAccess);
    const systemType = resolveFormSystemType(current.measurementPoints, query.systemType);
    const formContacts = await pomsFactoriesRepository.findFactoryFormContacts(
      current.eligibleFactoryId,
      systemType,
    );
    return toPomsConnectionRequestForm(
      current,
      current.measurementPoints,
      systemType,
      undefined,
      formContacts,
      true,
    );
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
      const proposedFactory = buildProposedProfile(current, input);
      const contacts = await prepareContactSnapshots(current, input, proposed);
      if (!contactsChanged(contacts.currentContacts, contacts.proposedContacts)) {
        ensureMeasurementRequestChanged(current, proposedFactory, proposed);
      }
      return pomsFactoriesRepository.createEditRequest(
        current,
        {
          formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS,
          proposedFactory,
          proposedMeasurementPoints: proposed,
          ...contacts,
        },
        input.note ?? null,
        actorUserId,
      );
    }

    const proposed = buildProposedProfile(current, input);
    const contacts = await prepareContactSnapshots(current, input, current.measurementPoints);
    if (!contactsChanged(contacts.currentContacts, contacts.proposedContacts))
      ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.createEditRequest(
      current,
      {
        formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO,
        proposedFactory: proposed,
        proposedMeasurementPoints: null,
        ...contacts,
      },
      null,
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
  ): Promise<PomsFactoryEditRequestDetailDTO> {
    const request = await pomsFactoriesRepository.findEditRequestById(id, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    if (!request) throw new NotFoundError('POMS factory edit request not found');
    // BASIC_INFO is factory-wide; null means an ambiguous measurement-point request.
    const systemType = request.proposedContacts
      ? (request.proposedContacts.systemType ?? undefined)
      : request.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO
        ? undefined
        : resolveEditRequestContactSystemType(request);
    const formContacts =
      systemType === null
        ? null
        : await pomsFactoriesRepository.findFactoryFormContacts(
            request.eligibleFactoryId,
            systemType,
          );
    return {
      ...request,
      currentContacts: request.currentContacts ?? null,
      proposedContacts: request.proposedContacts ?? null,
      contactPersons: (
        request.proposedContacts?.contactPersons ??
        formContacts?.contactPersons ??
        []
      ).map((contact) => ({ ...contact })),
      notificationEmails: [
        ...(request.proposedContacts?.notificationEmails ?? formContacts?.notificationEmails ?? []),
      ],
      officerNotificationEmails:
        request.proposedContacts?.officerNotificationEmails ??
        measurementPointOfficerEmails(
          (request.proposedMeasurementPoints ?? []).filter(
            (point) => systemType === undefined || point.systemType === systemType,
          ),
          formContacts?.officerNotificationEmails,
        ),
      informationProviderName: formContacts?.informationProviderName ?? null,
      informationProviderPosition: formContacts?.informationProviderPosition ?? null,
      currentMeasurementPoints:
        request.currentMeasurementPoints?.map((point) => ({
          ...point,
          details: deriveCurrentPomsParameterDetails(point),
        })) ?? null,
    };
  },

  async cancelEditRequest(
    id: number,
    actorUserId: number,
    editScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<PomsFactoryEditRequestDTO> {
    const request = await this.getEditRequest(id, actorUserId, editScope, regionalAccess);
    if (request.createdBy !== actorUserId) {
      throw new ForbiddenError('Only the request owner can perform this action');
    }
    if (!CANCELLABLE_POMS_FACTORY_EDIT_REQUEST_STATUSES.includes(request.status)) {
      throw invalidCancellationTransition(id, request.status);
    }
    return pomsFactoriesRepository.cancelEditRequest(id, actorUserId);
  },

  async getEditRequestForm(
    id: number,
    actorUserId: number,
    viewScope: AccessScope,
    query: { systemType?: ConnectionSystemType },
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<ConnectionRequestFormDTO> {
    const request = await this.getEditRequest(id, actorUserId, viewScope, regionalAccess);
    const current = await this.getFactoryDetail(
      request.factoryId,
      actorUserId,
      viewScope,
      regionalAccess,
    );
    const profile =
      request.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO ||
      hasProfileChanges(request.currentFactory, request.proposedFactory)
        ? { ...toProfileSnapshot(current), ...editableProfile(request.proposedFactory) }
        : current;
    const points =
      request.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
        ? (request.proposedMeasurementPoints ??
          request.currentMeasurementPoints ??
          current.measurementPoints)
        : current.measurementPoints;
    const systemType = resolveFormSystemType(points, query.systemType);
    const formContacts = await pomsFactoriesRepository.findFactoryFormContacts(
      request.eligibleFactoryId,
      systemType,
    );
    const proposedContacts =
      request.proposedContacts &&
      (request.proposedContacts.systemType === null ||
        request.proposedContacts.systemType === systemType)
        ? request.proposedContacts
        : null;
    const form = toPomsConnectionRequestForm(
      profile,
      points,
      systemType,
      request.requestNote,
      proposedContacts
        ? {
            ...formContacts,
            ...proposedContacts,
            contactName: proposedContacts.contactPersons[0]?.name ?? '',
            contactPhone: proposedContacts.contactPersons[0]?.phone ?? '',
            contactEmail: proposedContacts.contactPersons[0]?.email ?? null,
            informationProviderName: formContacts?.informationProviderName ?? null,
            informationProviderPosition: formContacts?.informationProviderPosition ?? null,
          }
        : formContacts,
    );
    if (proposedContacts) {
      form.officerNotificationEmails = [...proposedContacts.officerNotificationEmails];
    }
    return form;
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
      const proposedFactory = buildProposedProfile(current, input);
      const contacts = await prepareContactSnapshots(current, input, proposed);
      if (!contactsChanged(contacts.currentContacts, contacts.proposedContacts)) {
        ensureMeasurementRequestChanged(current, proposedFactory, proposed);
      }
      return pomsFactoriesRepository.resubmitEditRequest(
        id,
        {
          formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS,
          ...(isCanonicalFactoryProfilesEnabled() ? { currentFactory: current } : {}),
          proposedFactory,
          proposedMeasurementPoints: proposed,
          ...contacts,
        },
        input.note ?? null,
        actorUserId,
      );
    }

    if (request.formType !== POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO) {
      throw new ConflictError('POMS factory edit request form type cannot change on resubmission');
    }
    const proposed = buildProposedProfile(current, input);
    const contacts = await prepareContactSnapshots(current, input, current.measurementPoints);
    if (!contactsChanged(contacts.currentContacts, contacts.proposedContacts))
      ensureProfileChanged(current, proposed);
    return pomsFactoriesRepository.resubmitEditRequest(
      id,
      {
        formType: POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO,
        ...(isCanonicalFactoryProfilesEnabled() ? { currentFactory: current } : {}),
        proposedFactory: proposed,
        proposedMeasurementPoints: null,
        ...contacts,
      },
      null,
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
  ): Promise<PomsFactoryEditRequestDetailDTO> {
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
    const reviewed = await pomsFactoriesRepository.reviewEditRequest(id, input, actorUserId);
    return {
      ...reviewed,
      contactPersons: (reviewed.proposedContacts?.contactPersons ?? request.contactPersons).map(
        (contact) => ({ ...contact }),
      ),
      notificationEmails: [
        ...(reviewed.proposedContacts?.notificationEmails ?? request.notificationEmails),
      ],
      officerNotificationEmails: [
        ...(reviewed.proposedContacts?.officerNotificationEmails ??
          request.officerNotificationEmails),
      ],
      informationProviderName: request.informationProviderName,
      informationProviderPosition: request.informationProviderPosition,
      currentMeasurementPoints:
        reviewed.currentMeasurementPoints?.map((point) => ({
          ...point,
          details: deriveCurrentPomsParameterDetails(point),
        })) ?? null,
    };
  },
};

function invalidCancellationTransition(
  id: number,
  status: PomsFactoryEditRequestDTO['status'],
): AppError {
  return new AppError('ไม่สามารถยกเลิกคำขอในสถานะปัจจุบันได้', 409, 'INVALID_STATUS_TRANSITION', {
    id,
    status,
    allowedStatuses: CANCELLABLE_POMS_FACTORY_EDIT_REQUEST_STATUSES,
  });
}

const FACTORY_FRONT_PHOTO_DOCUMENT_TITLE = 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน';
const FACTORY_LOGO_DOCUMENT_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';

function resolveFormSystemType(
  points: PomsMeasurementPointDTO[],
  requestedSystemType?: ConnectionSystemType,
): ConnectionSystemType {
  const availableSystemTypes = [...new Set(points.map((point) => point.systemType))].sort();
  if (requestedSystemType) {
    if (availableSystemTypes.includes(requestedSystemType)) return requestedSystemType;
    throw new BadRequestError('Requested systemType is not available for this POMS factory', {
      requestedSystemType,
      availableSystemTypes,
    });
  }
  if (availableSystemTypes.length === 1) return availableSystemTypes[0];
  if (availableSystemTypes.length === 0) {
    throw new NotFoundError('POMS factory has no active measurement points');
  }
  throw new BadRequestError(
    'systemType query is required when a POMS factory has both CEMS and WPMS points',
    { availableSystemTypes },
  );
}

function toPomsConnectionRequestForm(
  profile: PomsFactoryProfileDTO,
  points: PomsMeasurementPointDTO[],
  systemType: ConnectionSystemType,
  remarks?: string | null,
  formContacts?: PomsFactoryFormContactsDTO | null,
  deriveCurrentParameterGroups = false,
): ConnectionRequestFormDTO {
  const baseForm = emptyConnectionRequestForm(profile, systemType);
  const measurementPoints = points
    .filter((point) => point.systemType === systemType)
    .map((point) => ({
      pointName: point.pointName,
      pointCode: point.pointCode,
      pointType: point.pointType,
      latitude: null,
      longitude: null,
      ...(point.parameters.length > 0 ? { parameters: [...point.parameters] } : {}),
      description: null,
      monitoringPointStatus: point.monitoringPointStatus,
      details: deriveCurrentParameterGroups
        ? deriveCurrentPomsParameterDetails(point)
        : point.details
          ? { ...point.details }
          : null,
      documentsAndImages: point.documentsAndImages.map((document) => ({ ...document })),
      measurementInstruments: point.measurementInstruments
        ? {
            ...point.measurementInstruments,
            parameters: point.measurementInstruments.parameters.map((parameter) => ({
              ...parameter,
            })),
          }
        : null,
    }));

  return {
    ...baseForm,
    factoryId: profile.factoryId,
    factoryName: profile.factoryName,
    factoryRegistrationNo: profile.factoryRegistrationNo,
    eia: profile.eia,
    eiaOther: profile.eiaOther,
    hasEia: profile.eia ? deriveHasEiaFromAssessment(profile.eia) : null,
    projectName: profile.projectName,
    address: profile.factoryAddress,
    provinceName: profile.provinceName,
    industrialEstateName: profile.industrialEstateName,
    latitude: profile.latitude,
    longitude: profile.longitude,
    systemType,
    contactName: formContacts?.contactName ?? baseForm.contactName,
    contactPhone: formContacts?.contactPhone ?? baseForm.contactPhone,
    contactEmail: formContacts?.contactEmail ?? baseForm.contactEmail,
    contactPersons: (formContacts?.contactPersons ?? []).map((contact) => ({ ...contact })),
    notificationEmails: [...(formContacts?.notificationEmails ?? [])],
    officerNotificationEmails: measurementPointOfficerEmails(
      points.filter((point) => point.systemType === systemType),
      formContacts?.officerNotificationEmails,
    ),
    informationProviderName: formContacts?.informationProviderName ?? null,
    informationProviderPosition: formContacts?.informationProviderPosition ?? null,
    measurementPoints: mergeFactoryProfileDocuments(
      measurementPoints,
      profile.factoryFrontPhotos,
      profile.factoryLogo,
    ),
    remarks: remarks ?? null,
  };
}

function deriveCurrentPomsParameterDetails(
  point: PomsMeasurementPointDTO,
): NonNullable<ConnectionRequestFormDTO['measurementPoints'][number]['details']> {
  const details = point.details ?? {};
  const eligibleParameters = Array.isArray(details.eligibleParameters)
    ? details.eligibleParameters.filter(
        (parameter): parameter is string => typeof parameter === 'string',
      )
    : [];
  const connectedParameters = [...point.parameters];
  const connectedParameterKeys = new Set(connectedParameters.map(normalizePomsParameterKey));
  const pendingParameters = eligibleParameters.filter(
    (parameter) => !connectedParameterKeys.has(normalizePomsParameterKey(parameter)),
  );

  return {
    ...details,
    eligibleParameters,
    connectedParameters,
    pendingParameters,
    requestedParameters: [...connectedParameters],
  };
}

function normalizePomsParameterKey(parameter: string): string {
  return parameter.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function resolveEditRequestContactSystemType(
  request: PomsFactoryEditRequestDTO,
): ConnectionSystemType | null {
  const currentById = new Map(
    (request.currentMeasurementPoints ?? []).map((point) => [point.connectedPointId, point]),
  );
  const proposedPoints = request.proposedMeasurementPoints ?? [];
  const changedPoints = proposedPoints.filter((point) => {
    const current = currentById.get(point.connectedPointId);
    return (
      !current ||
      JSON.stringify(editableMeasurementPoint(current)) !==
        JSON.stringify(editableMeasurementPoint(point))
    );
  });
  const candidatePoints =
    changedPoints.length > 0
      ? changedPoints
      : proposedPoints.length > 0
        ? proposedPoints
        : (request.currentMeasurementPoints ?? []);
  const systemTypes = [...new Set(candidatePoints.map((point) => point.systemType))];
  return systemTypes.length === 1 ? systemTypes[0] : null;
}

function emptyConnectionRequestForm(
  profile: PomsFactoryProfileDTO,
  systemType: ConnectionSystemType,
): ConnectionRequestFormDTO {
  return {
    requestType: CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    factoryId: profile.factoryId,
    factoryName: profile.factoryName,
    factoryRegistrationNo: profile.factoryRegistrationNo,
    industryMainOrder: profile.industryMainOrder ?? null,
    industryMainOrderLabel: profile.industryMainOrderLabel ?? null,
    industrySubOrder: profile.industrySubOrder ?? null,
    businessActivity: profile.businessActivity ?? null,
    eia: profile.eia,
    eiaOther: profile.eiaOther,
    hasEia: profile.eia ? deriveHasEiaFromAssessment(profile.eia) : null,
    projectName: profile.projectName,
    address: profile.factoryAddress,
    regionCode: null,
    regionName: null,
    provinceCode: null,
    provinceName: profile.provinceName,
    districtCode: null,
    districtName: null,
    subdistrictCode: null,
    subdistrictName: null,
    industrialEstateCode: null,
    industrialEstateName: profile.industrialEstateName,
    latitude: profile.latitude,
    longitude: profile.longitude,
    systemType,
    contactName: '',
    contactPhone: '',
    contactEmail: null,
    contactPersons: [],
    notificationEmails: [],
    officerNotificationEmails: [],
    informationProviderName: null,
    informationProviderPosition: null,
    measurementPoints: [],
    remarks: null,
  };
}

function mergeFactoryProfileDocuments(
  points: ConnectionRequestFormDTO['measurementPoints'],
  factoryFrontPhotos: RequestDocumentImageInput[],
  factoryLogo: RequestDocumentImageInput | null,
): ConnectionRequestFormDTO['measurementPoints'] {
  const withoutProfileDocuments = points.map((point) => ({
    ...point,
    documentsAndImages: (point.documentsAndImages ?? []).filter(
      (document) =>
        document.title !== FACTORY_FRONT_PHOTO_DOCUMENT_TITLE &&
        document.title !== FACTORY_LOGO_DOCUMENT_TITLE,
    ),
  }));
  if (withoutProfileDocuments.length === 0) return withoutProfileDocuments;
  const profileDocuments = [
    ...factoryFrontPhotos.map((document) => ({ ...document })),
    ...(factoryLogo ? [{ ...factoryLogo }] : []),
  ];
  withoutProfileDocuments[0] = {
    ...withoutProfileDocuments[0],
    documentsAndImages: [
      ...(withoutProfileDocuments[0].documentsAndImages ?? []),
      ...profileDocuments,
    ],
  };
  return withoutProfileDocuments;
}

function buildProposedProfile(
  current: PomsFactoryProfileDTO,
  input: PomsFactoryProfilePatchInput,
): PomsFactoryProfileDTO {
  const proposed: PomsFactoryProfileDTO = {
    ...toProfileSnapshot(current),
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
    industryMainOrder: factory.industryMainOrder,
    industryMainOrderLabel: factory.industryMainOrderLabel,
    industrySubOrder: factory.industrySubOrder,
    businessActivity: factory.businessActivity,
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
  input: PomsFactoryProfilePatchInput,
  key: keyof PomsFactoryProfilePatchInput,
  current: T,
): T {
  return Object.prototype.hasOwnProperty.call(input, key) ? ((input[key] ?? null) as T) : current;
}

function ensureProfileChanged(
  current: PomsFactoryProfileDTO,
  proposed: PomsFactoryProfileDTO,
): void {
  if (!hasProfileChanges(current, proposed)) {
    throw new ConflictError('POMS factory edit request does not contain any changes');
  }
}

function hasProfileChanges(
  current: PomsFactoryProfileDTO,
  proposed: PomsFactoryProfileDTO,
): boolean {
  return JSON.stringify(editableProfile(current)) !== JSON.stringify(editableProfile(proposed));
}

function editableProfile(profile: PomsFactoryProfileDTO) {
  return {
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

  const selectedSystems = new Set(
    currentPoints
      .filter((candidate) => patchById.has(candidate.connectedPointId))
      .map((candidate) => candidate.systemType),
  );
  return currentPoints.map((point) => {
    let patch = patchById.get(point.connectedPointId);
    if (input.officerNotificationEmails !== undefined && selectedSystems.has(point.systemType)) {
      patch = {
        ...patch,
        connectedPointId: point.connectedPointId,
        officerNotificationEmails: input.officerNotificationEmails,
      };
    }
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

    const requested = requestedPointParameters(patch.details);
    return {
      ...point,
      ...(patch.officerNotificationEmails === undefined
        ? {}
        : {
            officerNotificationEmails: [...patch.officerNotificationEmails],
          }),
      parameters: requested ?? point.parameters,
      pointName: patch.pointName === undefined ? point.pointName : patch.pointName,
      monitoringPointStatus: Object.prototype.hasOwnProperty.call(patch, 'monitoringPointStatus')
        ? (patch.monitoringPointStatus ?? null)
        : point.monitoringPointStatus,
      details,
      documentsAndImages: Object.prototype.hasOwnProperty.call(patch, 'documentsAndImages')
        ? (patch.documentsAndImages ?? [])
        : point.documentsAndImages,
      measurementInstruments:
        requested === undefined
          ? measurementInstruments
          : alignPointInstruments(measurementInstruments, requested),
    };
  });
}

function ensureMeasurementRequestChanged(
  current: PomsFactoryDetailDTO,
  proposedFactory: PomsFactoryProfileDTO,
  proposedPoints: PomsMeasurementPointDTO[],
): void {
  if (
    !hasProfileChanges(current, proposedFactory) &&
    JSON.stringify(current.measurementPoints.map(editableMeasurementPoint)) ===
      JSON.stringify(proposedPoints.map(editableMeasurementPoint))
  ) {
    throw new ConflictError('POMS factory edit request does not contain any changes');
  }
}

function editableMeasurementPoint(point: PomsMeasurementPointDTO) {
  return {
    connectedPointId: point.connectedPointId,
    officerNotificationEmails: point.officerNotificationEmails,
    parameters: point.parameters,
    pointName: point.pointName,
    monitoringPointStatus: point.monitoringPointStatus,
    details: point.details,
    documentsAndImages: point.documentsAndImages,
    measurementInstruments: point.measurementInstruments,
  };
}

function ensureAdminReviewActor(actor: PomsFactoryReviewActorContext): void {
  if (actor.roles.includes('admin')) return;
  throw new ForbiddenError('POMS factory edit request review is limited to admin users');
}

// Historical snapshots lack this field; explicit [] must not fall back to source recipients.
function measurementPointOfficerEmails(
  points: PomsMeasurementPointDTO[],
  fallback: string[] = [],
): string[] {
  if (!points.some((point) => point.officerNotificationEmails !== undefined)) return [...fallback];
  return [...new Set(points.flatMap((point) => point.officerNotificationEmails ?? fallback))];
}

async function prepareContactSnapshots(
  current: PomsFactoryDetailDTO,
  input: CreateAnyPomsFactoryEditRequestInput,
  proposedPoints: PomsMeasurementPointDTO[],
) {
  const systems = isMeasurementPointsRequest(input)
    ? [
        ...new Set(
          current.measurementPoints
            .filter((point) =>
              input.measurementPoints.some(
                (patch) => patch.connectedPointId === point.connectedPointId,
              ),
            )
            .map((point) => point.systemType),
        ),
      ]
    : [];
  if (systems.length > 1) {
    if (
      input.contactPersons !== undefined ||
      input.notificationEmails !== undefined ||
      input.officerNotificationEmails !== undefined
    ) {
      throw new BadRequestError('Contact edits must select measurement points from one system');
    }
    return { currentContacts: null, proposedContacts: null };
  }
  const systemType = systems[0] ?? null;
  const source = await pomsFactoriesRepository.findFactoryFormContacts(
    current.eligibleFactoryId,
    systemType ?? undefined,
  );
  const currentContacts = contactSnapshot(source, current.measurementPoints, systemType);
  const proposedContacts = {
    ...contactSnapshot(source, proposedPoints, systemType),
    contactPersons: (input.contactPersons ?? currentContacts.contactPersons).map((contact) => ({
      ...contact,
    })),
    notificationEmails: [...(input.notificationEmails ?? currentContacts.notificationEmails)],
    ...(input.officerNotificationEmails === undefined
      ? {}
      : { officerNotificationEmails: [...input.officerNotificationEmails].sort() }),
  };
  return { currentContacts, proposedContacts };
}
