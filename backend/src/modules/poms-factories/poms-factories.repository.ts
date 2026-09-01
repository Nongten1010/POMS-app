import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { applyFactoryType88Filter } from '../../shared/utils/factory-type-scope';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { resolveAssignedRegions } from '../auth/regional-access';
import {
  deriveHasEiaFromAssessment,
  type ConnectionRequestEiaAssessment,
} from '../connection-requests/connection-request-eia';
import type {
  MeasurementInstrumentsInput,
  MeasurementPointDetailsInput,
  RequestDocumentImageInput,
} from '../connection-requests/connection-requests.types';
import type {
  ListPomsFactoryEditRequestsQuery,
  PomsFactoryDetailDTO,
  PomsFactoryEditRequestAction,
  PomsFactoryEditRequestDTO,
  PomsFactoryEditRequestEventDTO,
  PomsFactoryEditRequestFormType,
  PomsFactoryEditRequestStatus,
  PomsFactoryProfileDTO,
  PomsFactorySummaryDTO,
  PomsMeasurementPointDTO,
  ReviewPomsFactoryEditRequestInput,
} from './poms-factories.types';
import {
  POMS_FACTORY_EDIT_REQUEST_ACTION,
  POMS_FACTORY_EDIT_REQUEST_FORM_TYPE,
  POMS_FACTORY_EDIT_REQUEST_STATUS,
  POMS_FACTORY_EDIT_REQUEST_STATUS_LABELS,
} from './poms-factories.types';

type AccessScope = string | null | undefined | PermissionScopeDetails;
type DbExecutor = Knex | Knex.Transaction;

interface FactoryAccess {
  actorUserId: number;
  scope: AccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

interface ConnectedFactoryRow {
  connected_point_id: number | string;
  source_measurement_point_id: number | string;
  eligible_factory_id: number | string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  factory_address: string | null;
  factory_latitude: number | string | null;
  factory_longitude: number | string | null;
  factory_eia_assessment: ConnectionRequestEiaAssessment | null;
  factory_eia_other: string | null;
  factory_project_name: string | null;
  factory_front_photos_json: string | null;
  factory_logo_json: string | null;
  province_name: string | null;
  industrial_estate_name: string | null;
  system_type: 'CEMS' | 'WPMS';
  point_name: string;
  point_code: string | null;
  point_type: 'STACK' | 'WASTEWATER' | 'OTHER';
  parameters_json: string;
  monitoring_point_status: PomsMeasurementPointDTO['monitoringPointStatus'];
  details_json: string | null;
  documents_json: string | null;
  instruments_json: string | null;
  updated_at: Date | string;
}

interface EditRequestRow {
  id: number | string;
  request_no: string;
  eligible_factory_id: number | string;
  factory_id: string;
  factory_registration_no: string;
  factory_name: string;
  form_type: PomsFactoryEditRequestFormType;
  status: PomsFactoryEditRequestStatus;
  revision_no: number | string;
  is_open: boolean | number;
  current_factory_json: string;
  proposed_factory_json: string;
  current_measurement_points_json: string | null;
  proposed_measurement_points_json: string | null;
  source_profile_updated_at: Date | string;
  request_note: string | null;
  revision_reason: string | null;
  officer_note: string | null;
  submitted_by: number | string;
  reviewed_by: number | string | null;
  submitted_at: Date | string;
  reviewed_at: Date | string | null;
  approved_at: Date | string | null;
  created_by: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface EditRequestEventRow {
  id: number | string;
  request_id: number | string;
  action: PomsFactoryEditRequestAction;
  from_status: PomsFactoryEditRequestStatus | null;
  to_status: PomsFactoryEditRequestStatus;
  event_note: string | null;
  actor_user_id: number | string;
  created_at: Date | string;
}

interface PendingCountRow {
  eligible_factory_id: number | string;
  form_type?: PomsFactoryEditRequestFormType;
  total: number | string;
}

interface EditRequestPayload {
  formType: PomsFactoryEditRequestFormType;
  proposedFactory: PomsFactoryProfileDTO;
  proposedMeasurementPoints: PomsMeasurementPointDTO[] | null;
}

const REVIEWABLE_STATUSES: PomsFactoryEditRequestStatus[] = [
  POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
  POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW,
];

const PARAMETER_DISPLAY_LABELS: Record<string, string> = {
  bod: 'BOD (mg/L)',
  co: 'CO (ppm)',
  co2: 'CO2 (ppm)',
  cod: 'COD (mg/L)',
  flow: 'Flow Rate (m3/hr)',
  flowrate: 'Flow Rate (m3/hr)',
  no: 'NO (ppm)',
  nox: 'NOx (ppm)',
  o2: 'O2 (%)',
  so2: 'SO2 (ppm)',
  temp: 'Temp. (°C)',
  temperature: 'Temp. (°C)',
  tss: 'TSS (mg/L)',
};

export const pomsFactoriesRepository = {
  async listFactories(access: FactoryAccess, search?: string): Promise<PomsFactorySummaryDTO[]> {
    const rows = await buildConnectedFactoryRowsQuery(access, search);
    const summaries = summarizeFactories(rows);
    const pendingCounts = await listPendingRequestCounts(
      summaries.map((factory) => factory.eligibleFactoryId),
    );
    return summaries.map((factory) => ({
      ...factory,
      pendingEditRequestCount: pendingCounts.get(factory.eligibleFactoryId) ?? 0,
    }));
  },

  async findFactoryDetail(
    factoryId: string,
    access: FactoryAccess,
  ): Promise<PomsFactoryDetailDTO | null> {
    const rows = await buildConnectedFactoryRowsQuery(access).where((builder) => {
      builder
        .where('cp.factory_id', factoryId)
        .orWhere('cp.factory_registration_no', factoryId)
        .orWhere('ef.source_factory_id', factoryId)
        .orWhere('ef.factory_registration_no_new', factoryId)
        .orWhere('ef.factory_registration_no_old', factoryId);
    });
    if (rows.length === 0) return null;
    const uniqueRows = uniqueConnectedPointRows(rows);
    return toFactoryDetail(
      uniqueRows,
      await pendingCountForFactory(uniqueRows[0].eligible_factory_id),
    );
  },

  async findOpenEditRequestForFactory(
    eligibleFactoryId: number,
    formType?: PomsFactoryEditRequestFormType,
  ): Promise<PomsFactoryEditRequestDTO | null> {
    const query = db<EditRequestRow>('poms_factory_edit_requests')
      .where('eligible_factory_id', eligibleFactoryId)
      .where('is_open', true)
      .whereNull('deleted_at')
      .orderBy('id', 'desc');
    if (formType) query.where('form_type', formType);
    const row = await query.first();
    return row ? hydrateEditRequest(row, db) : null;
  },

  async createEditRequest(
    current: PomsFactoryDetailDTO,
    payload: EditRequestPayload,
    requestNote: string | null,
    actorUserId: number,
  ): Promise<PomsFactoryEditRequestDTO> {
    try {
      return await db.transaction(async (trx) => {
        const live = await lockCurrentFactoryProfile(trx, current.eligibleFactoryId);
        ensureSameProfileVersion(current.updatedAt, live.updatedAt);

        const openRequest = await trx<EditRequestRow>('poms_factory_edit_requests')
          .where('eligible_factory_id', current.eligibleFactoryId)
          .where('form_type', payload.formType)
          .where('is_open', true)
          .whereNull('deleted_at')
          .forUpdate()
          .first('id');
        if (openRequest) {
          throw new ConflictError('Factory already has an open POMS edit request', {
            requestId: Number(openRequest.id),
          });
        }

        const requestNo = createRequestNo();
        const [created] = await trx('poms_factory_edit_requests')
          .insert({
            request_no: requestNo,
            eligible_factory_id: current.eligibleFactoryId,
            factory_id: current.factoryId,
            factory_registration_no: current.factoryRegistrationNo,
            factory_name:
              payload.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
                ? current.factoryName
                : payload.proposedFactory.factoryName,
            form_type: payload.formType,
            status: POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
            revision_no: 0,
            is_open: true,
            current_factory_json: JSON.stringify(toProfile(current)),
            proposed_factory_json: JSON.stringify(payload.proposedFactory),
            current_measurement_points_json:
              payload.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
                ? JSON.stringify(current.measurementPoints)
                : null,
            proposed_measurement_points_json:
              payload.proposedMeasurementPoints == null
                ? null
                : JSON.stringify(payload.proposedMeasurementPoints),
            source_profile_updated_at: new Date(current.updatedAt),
            request_note: requestNote,
            revision_reason: null,
            officer_note: null,
            submitted_by: actorUserId,
            submitted_at: trx.fn.now(),
            created_by: actorUserId,
            updated_by: actorUserId,
          })
          .returning('id');
        const requestId = Number(created.id);
        await insertEvent(trx, {
          requestId,
          action: POMS_FACTORY_EDIT_REQUEST_ACTION.SUBMIT,
          fromStatus: null,
          toStatus: POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
          note: requestNote,
          actorUserId,
          snapshot: buildEventSnapshot(payload),
        });
        return requireEditRequestInTransaction(trx, requestId);
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      if (isUniqueViolation(error)) {
        throw new ConflictError('Factory already has an open POMS edit request');
      }
      throw error;
    }
  },

  async listEditRequests(
    query: ListPomsFactoryEditRequestsQuery,
    access: FactoryAccess,
  ): Promise<PomsFactoryEditRequestDTO[]> {
    const builder = buildEditRequestsQuery(access);
    if (query.status) builder.where('req.status', query.status);
    if (query.factoryId) {
      builder.where((whereBuilder) => {
        whereBuilder
          .where('req.factory_id', query.factoryId as string)
          .orWhere('req.factory_registration_no', query.factoryId as string)
          .orWhere('ef.source_factory_id', query.factoryId as string)
          .orWhere('ef.factory_registration_no_new', query.factoryId as string)
          .orWhere('ef.factory_registration_no_old', query.factoryId as string);
      });
    }
    if (query.search) {
      const search = `%${query.search}%`;
      builder.where((whereBuilder) => {
        whereBuilder
          .where('req.request_no', 'like', search)
          .orWhere('req.factory_id', 'like', search)
          .orWhere('req.factory_registration_no', 'like', search)
          .orWhere('req.factory_name', 'like', search);
      });
    }
    const rows = (await builder
      .distinct('req.*')
      .orderBy('req.created_at', 'desc')
      .orderBy('req.id', 'desc')) as EditRequestRow[];
    return hydrateEditRequests(rows, db);
  },

  async findEditRequestById(
    id: number,
    access: FactoryAccess,
  ): Promise<PomsFactoryEditRequestDTO | null> {
    const row = await buildEditRequestsQuery(access).where('req.id', id).select('req.*').first();
    return row ? hydrateEditRequest(row, db) : null;
  },

  async resubmitEditRequest(
    id: number,
    payload: EditRequestPayload,
    requestNote: string | null,
    actorUserId: number,
  ): Promise<PomsFactoryEditRequestDTO> {
    return db.transaction(async (trx) => {
      const request = await trx<EditRequestRow>('poms_factory_edit_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first();
      if (!request) throw new NotFoundError('POMS factory edit request not found');
      if (request.status !== POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED) {
        throw new ConflictError(
          'POMS factory edit request cannot be resubmitted from its current status',
          {
            currentStatus: request.status,
            allowedStatuses: [POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED],
          },
        );
      }
      if (Number(request.eligible_factory_id) !== payload.proposedFactory.eligibleFactoryId) {
        throw new ConflictError('POMS factory identity changed before resubmission');
      }
      if (request.form_type !== payload.formType) {
        throw new ConflictError(
          'POMS factory edit request form type cannot change on resubmission',
        );
      }

      const live = await lockCurrentFactoryProfile(trx, payload.proposedFactory.eligibleFactoryId);
      ensureSameProfileVersion(payload.proposedFactory.updatedAt, live.updatedAt);
      await trx('poms_factory_edit_requests')
        .where('id', id)
        .update({
          factory_name:
            payload.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
              ? live.factoryName
              : payload.proposedFactory.factoryName,
          form_type: payload.formType,
          status: POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW,
          revision_no: Number(request.revision_no) + 1,
          is_open: true,
          current_factory_json: JSON.stringify(toProfile(live)),
          proposed_factory_json: JSON.stringify(payload.proposedFactory),
          current_measurement_points_json:
            payload.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
              ? JSON.stringify(live.measurementPoints)
              : null,
          proposed_measurement_points_json:
            payload.proposedMeasurementPoints == null
              ? null
              : JSON.stringify(payload.proposedMeasurementPoints),
          source_profile_updated_at: new Date(payload.proposedFactory.updatedAt),
          request_note: requestNote,
          revision_reason: null,
          officer_note: null,
          submitted_by: actorUserId,
          submitted_at: trx.fn.now(),
          reviewed_by: null,
          reviewed_at: null,
          approved_at: null,
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });
      await insertEvent(trx, {
        requestId: id,
        action: POMS_FACTORY_EDIT_REQUEST_ACTION.RESUBMIT,
        fromStatus: request.status,
        toStatus: POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW,
        note: requestNote,
        actorUserId,
        snapshot: buildEventSnapshot(payload),
      });
      return requireEditRequestInTransaction(trx, id);
    });
  },

  async reviewEditRequest(
    id: number,
    input: ReviewPomsFactoryEditRequestInput,
    actorUserId: number,
  ): Promise<PomsFactoryEditRequestDTO> {
    return db.transaction(async (trx) => {
      const request = await trx<EditRequestRow>('poms_factory_edit_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first();
      if (!request) throw new NotFoundError('POMS factory edit request not found');
      if (!REVIEWABLE_STATUSES.includes(request.status)) {
        throw new ConflictError(
          'POMS factory edit request cannot be reviewed from its current status',
          {
            currentStatus: request.status,
            allowedStatuses: REVIEWABLE_STATUSES,
          },
        );
      }
      if (
        Number(request.created_by) === actorUserId ||
        Number(request.submitted_by) === actorUserId
      ) {
        throw new ForbiddenError(
          'The request creator or latest submitter cannot review their own POMS factory edit request',
        );
      }

      const transition = reviewTransition(input);
      if (transition.status === POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED) {
        await applyApprovedRequestInTransaction(trx, request, actorUserId);
      }
      const now = trx.fn.now();
      await trx('poms_factory_edit_requests')
        .where('id', id)
        .update({
          status: transition.status,
          is_open: transition.isOpen,
          revision_reason:
            input.decision === POMS_FACTORY_EDIT_REQUEST_ACTION.REQUEST_REVISION
              ? (input.revisionReason ?? null)
              : null,
          officer_note: input.officerNote ?? null,
          reviewed_by: actorUserId,
          reviewed_at: now,
          approved_at: transition.status === POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED ? now : null,
          updated_by: actorUserId,
          updated_at: now,
        });
      await insertEvent(trx, {
        requestId: id,
        action: input.decision,
        fromStatus: request.status,
        toStatus: transition.status,
        note:
          input.decision === POMS_FACTORY_EDIT_REQUEST_ACTION.REQUEST_REVISION
            ? (input.revisionReason ?? null)
            : (input.officerNote ?? null),
        actorUserId,
        snapshot: toStoredEventSnapshot(request),
      });
      return requireEditRequestInTransaction(trx, id);
    });
  },
};

export function buildConnectedFactoryRowsQueryForTests(
  access: FactoryAccess,
  search?: string,
): Knex.QueryBuilder<ConnectedFactoryRow, ConnectedFactoryRow[]> {
  return buildConnectedFactoryRowsQuery(access, search);
}

export function buildEditRequestsQueryForTests(
  access: FactoryAccess,
): Knex.QueryBuilder<EditRequestRow, EditRequestRow[]> {
  return buildEditRequestsQuery(access);
}

export function buildApprovedPomsFactoryProfilePatchesForTests(proposed: PomsFactoryProfileDTO) {
  return buildApprovedPomsFactoryProfilePatches(proposed);
}

export function buildApprovedMeasurementPointWritePatchForTests(point: PomsMeasurementPointDTO) {
  return buildApprovedMeasurementPointWritePatch(point);
}

export function buildApprovedPomsMeasurementPointUpdatesForTests(
  current: PomsMeasurementPointDTO[],
  proposed: PomsMeasurementPointDTO[],
) {
  return buildApprovedPomsMeasurementPointUpdates(current, proposed);
}

export function buildPendingRequestCountsQueryForTests(ids: number[]) {
  return buildPendingRequestCountsQuery(ids).toSQL();
}

export function toPomsParameterDisplayNamesForTests(
  parameters: string[],
  instruments: MeasurementInstrumentsInput | null = null,
): string[] {
  return toPomsParameterDisplayNames(parameters, instruments);
}

async function applyApprovedRequestInTransaction(
  trx: Knex.Transaction,
  request: EditRequestRow,
  actorUserId: number,
): Promise<void> {
  if (request.form_type === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS) {
    const currentMeasurementPoints = requireMeasurementPointSnapshotArray(
      request.current_measurement_points_json,
    );
    const latestProfile = await lockCurrentFactoryProfile(trx, Number(request.eligible_factory_id));
    const currentLiveMeasurementPoints = latestProfile.measurementPoints;
    ensureSameMeasurementPointsVersion(currentMeasurementPoints, currentLiveMeasurementPoints);
    const proposedMeasurementPoints = requireMeasurementPointSnapshotArray(
      request.proposed_measurement_points_json,
    );
    await applyApprovedMeasurementPointsInTransaction(
      trx,
      Number(request.eligible_factory_id),
      currentMeasurementPoints,
      proposedMeasurementPoints,
      actorUserId,
    );
    return;
  }

  const latestProfile = await lockCurrentFactoryProfile(trx, Number(request.eligible_factory_id));
  ensureSameProfileVersion(
    toIsoStringRequired(request.source_profile_updated_at),
    latestProfile.updatedAt,
  );
  const proposed = requireProfileSnapshot(request.proposed_factory_json);
  const patches = buildApprovedPomsFactoryProfilePatches(proposed);
  const connectedPointUpdateCount = await trx('cems_wpms_connected_measurement_points')
    .where('eligible_factory_id', request.eligible_factory_id)
    .whereNull('deleted_at')
    .update({
      ...patches.connected,
      updated_by: actorUserId,
      updated_at: trx.fn.now(),
    });
  if (connectedPointUpdateCount === 0) {
    throw new ConflictError('Connected POMS factory is no longer active');
  }

  const eligibleFactoryUpdateCount = await trx('eligible_factories')
    .where('id', request.eligible_factory_id)
    .whereNull('deleted_at')
    .update({
      ...patches.eligible,
      updated_by: actorUserId,
      updated_at: trx.fn.now(),
    });
  if (eligibleFactoryUpdateCount === 0) {
    throw new ConflictError('Eligible factory is no longer active');
  }
}

async function applyApprovedMeasurementPointsInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
  currentPoints: PomsMeasurementPointDTO[],
  proposedPoints: PomsMeasurementPointDTO[],
  actorUserId: number,
): Promise<void> {
  const updates = buildApprovedPomsMeasurementPointUpdates(currentPoints, proposedPoints);
  if (updates.length === 0) {
    throw new ConflictError('POMS measurement-point edit request does not contain any changes');
  }

  for (const update of updates) {
    const updatedCount = await trx('cems_wpms_connected_measurement_points')
      .where('id', update.connectedPointId)
      .where('eligible_factory_id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        ...update.patch,
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      });
    if (updatedCount !== 1) {
      throw new ConflictError('Connected POMS measurement point is no longer active', {
        connectedPointId: update.connectedPointId,
      });
    }
  }
}

function buildApprovedPomsFactoryProfilePatches(proposed: PomsFactoryProfileDTO) {
  const hasEia = proposed.eia == null ? null : deriveHasEiaFromAssessment(proposed.eia);
  const eiaOther = proposed.eia === 'อื่นๆ' ? proposed.eiaOther : null;
  return {
    connected: {
      factory_name: proposed.factoryName,
      factory_address: proposed.factoryAddress,
      factory_latitude: proposed.latitude,
      factory_longitude: proposed.longitude,
      factory_eia_assessment: proposed.eia,
      factory_eia_other: eiaOther,
      factory_has_eia: hasEia,
      factory_project_name: proposed.projectName,
      factory_front_photos_json:
        proposed.factoryFrontPhotos.length > 0 ? JSON.stringify(proposed.factoryFrontPhotos) : null,
      factory_logo_json: proposed.factoryLogo ? JSON.stringify(proposed.factoryLogo) : null,
    },
    eligible: {
      factory_name: proposed.factoryName,
      address: proposed.factoryAddress,
      latitude: proposed.latitude,
      longitude: proposed.longitude,
      eia_assessment: proposed.eia,
      eia_other: eiaOther,
      has_eia: hasEia,
      project_name: proposed.projectName,
    },
  };
}

function buildApprovedMeasurementPointWritePatch(
  point: PomsMeasurementPointDTO,
  actorUserId?: number,
  updatedAt?: Knex.Raw | Date | string,
) {
  return {
    point_name: point.pointName,
    monitoring_point_status: point.monitoringPointStatus ?? null,
    details_json: point.details ? JSON.stringify(point.details) : null,
    documents_json:
      point.documentsAndImages.length > 0 ? JSON.stringify(point.documentsAndImages) : null,
    instruments_json: point.measurementInstruments
      ? JSON.stringify(point.measurementInstruments)
      : null,
    ...(actorUserId == null ? {} : { updated_by: actorUserId }),
    ...(updatedAt == null ? {} : { updated_at: updatedAt }),
  };
}

function buildApprovedPomsMeasurementPointUpdates(
  currentPoints: PomsMeasurementPointDTO[],
  proposedPoints: PomsMeasurementPointDTO[],
) {
  if (currentPoints.length !== proposedPoints.length) {
    throw new ConflictError('Stored POMS measurement-point proposal changed point identities');
  }

  const currentById = new Map(
    currentPoints.map((point) => [point.connectedPointId, point] as const),
  );

  return proposedPoints.flatMap((proposed) => {
    const current = currentById.get(proposed.connectedPointId);
    if (!current) {
      throw new ConflictError('Stored POMS measurement-point proposal changed point identities', {
        connectedPointId: proposed.connectedPointId,
      });
    }
    if (
      JSON.stringify(immutableMeasurementPointState(current)) !==
      JSON.stringify(immutableMeasurementPointState(proposed))
    ) {
      throw new ConflictError('Stored POMS measurement-point proposal changed immutable fields', {
        connectedPointId: proposed.connectedPointId,
      });
    }
    if (
      JSON.stringify(editableMeasurementPointState(current)) ===
      JSON.stringify(editableMeasurementPointState(proposed))
    ) {
      return [];
    }
    return [
      {
        connectedPointId: proposed.connectedPointId,
        patch: buildApprovedMeasurementPointWritePatch(proposed),
      },
    ];
  });
}

function immutableMeasurementPointState(point: PomsMeasurementPointDTO) {
  return {
    connectedPointId: point.connectedPointId,
    sourceMeasurementPointId: point.sourceMeasurementPointId,
    eligibleFactoryId: point.eligibleFactoryId,
    factoryId: point.factoryId,
    factoryName: point.factoryName,
    systemType: point.systemType,
    pointCode: point.pointCode,
    pointType: point.pointType,
    parameters: point.parameters,
    updatedAt: point.updatedAt,
  };
}

function editableMeasurementPointState(point: PomsMeasurementPointDTO) {
  return {
    pointName: point.pointName,
    monitoringPointStatus: point.monitoringPointStatus,
    details: point.details,
    documentsAndImages: point.documentsAndImages,
    measurementInstruments: point.measurementInstruments,
  };
}

function buildConnectedFactoryRowsQuery(
  access: FactoryAccess,
  search?: string,
  executor: DbExecutor = db,
): Knex.QueryBuilder<ConnectedFactoryRow, ConnectedFactoryRow[]> {
  const builder = executor<ConnectedFactoryRow>('cems_wpms_connected_measurement_points as cp')
    .innerJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'cp.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .leftJoin('factories as f', function joinFactory() {
      this.on(function joinFactoryKeys() {
        this.on('f.fid', '=', 'ef.source_factory_id')
          .orOn('f.code', '=', 'ef.source_factory_id')
          .orOn('f.fid', '=', 'ef.factory_registration_no_new')
          .orOn('f.code', '=', 'ef.factory_registration_no_new');
      }).andOnNull('f.deleted_at');
    })
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin('industrial_estates as ie', 'ie.name_th', 'ef.industrial_estate_name')
    .whereNull('cp.deleted_at');

  if (search) {
    const keyword = `%${search.trim()}%`;
    builder.where((whereBuilder) => {
      whereBuilder
        .where('cp.factory_name', 'like', keyword)
        .orWhere('cp.factory_id', 'like', keyword)
        .orWhere('cp.factory_registration_no', 'like', keyword)
        .orWhere('cp.point_name', 'like', keyword)
        .orWhere('cp.point_code', 'like', keyword);
    });
  }
  applyFactoryAccess(builder, access);
  return builder
    .select(
      'cp.id as connected_point_id',
      'cp.source_measurement_point_id',
      'cp.eligible_factory_id',
      'cp.factory_id',
      'cp.factory_name',
      'cp.factory_registration_no',
      'cp.factory_address',
      'cp.factory_latitude',
      'cp.factory_longitude',
      'cp.factory_eia_assessment',
      'cp.factory_eia_other',
      'cp.factory_project_name',
      'cp.factory_front_photos_json',
      'cp.factory_logo_json',
      'p.name_th as province_name',
      'ie.name_th as industrial_estate_name',
      'cp.system_type',
      'cp.point_name',
      'cp.point_code',
      'cp.point_type',
      'cp.parameters_json',
      'cp.monitoring_point_status',
      'cp.details_json',
      'cp.documents_json',
      'cp.instruments_json',
      'cp.updated_at',
    )
    .orderBy('cp.factory_name', 'asc')
    .orderBy('cp.factory_id', 'asc')
    .orderBy('cp.point_code', 'asc')
    .orderBy('cp.id', 'asc') as unknown as Knex.QueryBuilder<
    ConnectedFactoryRow,
    ConnectedFactoryRow[]
  >;
}

function buildEditRequestsQuery(
  access: FactoryAccess,
): Knex.QueryBuilder<EditRequestRow, EditRequestRow[]> {
  const builder = db<EditRequestRow>('poms_factory_edit_requests as req')
    .innerJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'req.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .leftJoin('factories as f', function joinFactory() {
      this.on(function joinFactoryKeys() {
        this.on('f.fid', '=', 'ef.source_factory_id')
          .orOn('f.code', '=', 'ef.source_factory_id')
          .orOn('f.fid', '=', 'ef.factory_registration_no_new')
          .orOn('f.code', '=', 'ef.factory_registration_no_new');
      }).andOnNull('f.deleted_at');
    })
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin('industrial_estates as ie', 'ie.name_th', 'ef.industrial_estate_name')
    .whereNull('req.deleted_at');
  applyFactoryAccess(builder, access);
  return builder as unknown as Knex.QueryBuilder<EditRequestRow, EditRequestRow[]>;
}

function applyFactoryAccess(builder: Knex.QueryBuilder, access: FactoryAccess): void {
  if (requiresAssignedFactoryAccess(access.scope)) {
    applyAssignedFactoryAccessFilter(builder, access.actorUserId);
  }
  applyFactoryPermissionLocationFilter(builder, access.scope, access.regionalAccess);
  applyFactoryRegionalAccessFilter(builder, access.scope, access.regionalAccess);
  if (getAccessScopeValue(access.scope) === 'FACTORY_TYPE_88') {
    applyFactoryType88Filter(builder, 'ef.factory_type_sequence');
  }
}

function getAccessScopeValue(scope: AccessScope): string | null | undefined {
  return scope && typeof scope === 'object' ? scope.scope : scope;
}

function requiresAssignedFactoryAccess(scope: AccessScope): boolean {
  const scopeValue = getAccessScopeValue(scope);
  if (scopeValue === 'ALL') return false;
  if (scopeValue === 'OWN_FACTORY') return true;
  return !['IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'FACTORY_TYPE_88'].includes(scopeValue ?? '');
}

function applyFactoryRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  scope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): void {
  if (['ALL', 'FACTORY_TYPE_88'].includes(getAccessScopeValue(scope) ?? '')) return;
  const regions = regionalAccess?.regions?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (regions.length > 0) builder.whereIn('p.region', [...new Set(regions)]);
}

function applyFactoryPermissionLocationFilter(
  builder: Knex.QueryBuilder,
  scope: AccessScope,
  regionalAccess?: RegionalAccessDTO | null,
): void {
  const scopeValue = getAccessScopeValue(scope);
  if (!scope || typeof scope !== 'object') {
    if (scopeValue === 'IN_REGION' || scopeValue === 'IN_PROVINCE' || scopeValue === 'IN_ESTATE') {
      builder.whereRaw('1 = 0');
    }
    return;
  }
  if (scope.scope === 'IN_REGION') {
    const regions = resolveAssignedRegions(scope.region, regionalAccess);
    if (regions.length === 0) builder.whereRaw('1 = 0');
    else builder.whereIn('p.region', regions);
  }
  if (scope.scope === 'IN_PROVINCE') {
    const province = normalizeLocationValue(scope.province);
    if (!province) builder.whereRaw('1 = 0');
    else builder.where('ef.province_name', province);
  }
  if (scope.scope === 'IN_ESTATE') {
    const estate = getScopeEstateValue(scope);
    if (!estate) builder.whereRaw('1 = 0');
    else {
      builder.where((estateBuilder) => {
        estateBuilder
          .where('ie.code', estate)
          .orWhere('ie.name_th', estate)
          .orWhereRaw('CAST(ie.id as varchar(32)) = ?', [estate]);
      });
    }
  }
}

function getScopeEstateValue(scope: PermissionScopeDetails): string | null {
  const values = [
    Reflect.get(scope as unknown as Record<string, unknown>, 'estateCode'),
    Reflect.get(scope as unknown as Record<string, unknown>, 'estateName'),
    Reflect.get(scope as unknown as Record<string, unknown>, 'estate'),
    Reflect.get(scope as unknown as Record<string, unknown>, 'estateId'),
  ];
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = normalizeLocationValue(value);
      if (normalized) return normalized;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== 'all' ? normalized : null;
}

async function lockCurrentFactoryProfile(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
): Promise<PomsFactoryDetailDTO> {
  const rows = await trx<ConnectedFactoryRow>('cems_wpms_connected_measurement_points as cp')
    .innerJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'cp.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin('industrial_estates as ie', 'ie.name_th', 'ef.industrial_estate_name')
    .where('cp.eligible_factory_id', eligibleFactoryId)
    .whereNull('cp.deleted_at')
    .forUpdate()
    .select(
      'cp.id as connected_point_id',
      'cp.source_measurement_point_id',
      'cp.eligible_factory_id',
      'cp.factory_id',
      'cp.factory_name',
      'cp.factory_registration_no',
      'cp.factory_address',
      'cp.factory_latitude',
      'cp.factory_longitude',
      'cp.factory_eia_assessment',
      'cp.factory_eia_other',
      'cp.factory_project_name',
      'cp.factory_front_photos_json',
      'cp.factory_logo_json',
      'p.name_th as province_name',
      'ie.name_th as industrial_estate_name',
      'cp.system_type',
      'cp.point_name',
      'cp.point_code',
      'cp.point_type',
      'cp.parameters_json',
      'cp.monitoring_point_status',
      'cp.details_json',
      'cp.documents_json',
      'cp.instruments_json',
      'cp.updated_at',
    );
  if (rows.length === 0) throw new ConflictError('Connected POMS factory is no longer active');
  return toFactoryDetail(uniqueConnectedPointRows(rows), 0);
}

function summarizeFactories(rows: ConnectedFactoryRow[]): PomsFactorySummaryDTO[] {
  const grouped = new Map<number, ConnectedFactoryRow[]>();
  uniqueConnectedPointRows(rows).forEach((row) => {
    const id = Number(row.eligible_factory_id);
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  });
  return [...grouped.values()].map((factoryRows) => toFactoryDetail(factoryRows, 0));
}

function toFactoryDetail(
  rows: ConnectedFactoryRow[],
  pendingEditRequestCount: number,
): PomsFactoryDetailDTO {
  const sortedByProfileVersion = [...rows].sort(
    (left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at),
  );
  const first = sortedByProfileVersion[0];
  return {
    eligibleFactoryId: Number(first.eligible_factory_id),
    factoryId: first.factory_id,
    factoryRegistrationNo: first.factory_registration_no,
    factoryName: first.factory_name,
    factoryAddress: first.factory_address,
    provinceName: first.province_name,
    industrialEstateName: first.industrial_estate_name,
    latitude: toNullableNumber(first.factory_latitude),
    longitude: toNullableNumber(first.factory_longitude),
    eia: first.factory_eia_assessment,
    eiaOther: first.factory_eia_other,
    projectName: first.factory_project_name,
    factoryFrontPhotos: parseJsonArray<RequestDocumentImageInput>(first.factory_front_photos_json),
    factoryLogo: parseJsonObject<RequestDocumentImageInput>(first.factory_logo_json),
    updatedAt: toIsoStringRequired(first.updated_at),
    systemTypes: [...new Set(rows.map((row) => row.system_type))].sort(),
    measurementPointCount: rows.length,
    pendingEditRequestCount,
    measurementPoints: rows.map(toMeasurementPointDTO),
  };
}

function toProfile(factory: PomsFactoryProfileDTO): PomsFactoryProfileDTO {
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

function toMeasurementPointDTO(row: ConnectedFactoryRow): PomsMeasurementPointDTO {
  const measurementInstruments = parseJsonObject<MeasurementInstrumentsInput>(row.instruments_json);
  return {
    connectedPointId: Number(row.connected_point_id),
    sourceMeasurementPointId: Number(row.source_measurement_point_id),
    eligibleFactoryId: Number(row.eligible_factory_id),
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    systemType: row.system_type,
    pointName: row.point_name,
    pointCode: row.point_code,
    pointType: row.point_type,
    parameters: toPomsParameterDisplayNames(
      parseJsonArray<string>(row.parameters_json),
      measurementInstruments,
    ),
    monitoringPointStatus: row.monitoring_point_status ?? null,
    details: parseJsonObject<MeasurementPointDetailsInput>(row.details_json),
    documentsAndImages: parseJsonArray<RequestDocumentImageInput>(row.documents_json),
    measurementInstruments,
    updatedAt: toIsoStringRequired(row.updated_at),
  };
}

function toPomsParameterDisplayNames(
  parameters: string[],
  instruments: MeasurementInstrumentsInput | null,
): string[] {
  const instrumentLabels = new Map<string, string>();
  for (const instrument of instruments?.parameters ?? []) {
    const label = instrument.parameter?.trim();
    if (!label || !hasParameterUnit(label)) continue;
    const key = parameterNameKey(label);
    if (key && !instrumentLabels.has(key)) instrumentLabels.set(key, label);
  }

  const labels = new Map<string, string>();
  for (const parameter of parameters) {
    const trimmed = parameter.trim();
    if (!trimmed) continue;
    const key = parameterNameKey(trimmed);
    const label = hasParameterUnit(trimmed)
      ? trimmed
      : (instrumentLabels.get(key) ?? PARAMETER_DISPLAY_LABELS[key] ?? trimmed);
    const uniqueKey = label.toLocaleLowerCase('en-US');
    if (!labels.has(uniqueKey)) labels.set(uniqueKey, label);
  }
  return [...labels.values()];
}

function hasParameterUnit(parameter: string): boolean {
  return /\([^)]*\)/u.test(parameter);
}

function parameterNameKey(parameter: string): string {
  return parameter
    .replace(/\([^)]*\)/gu, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '');
}

function uniqueConnectedPointRows(rows: ConnectedFactoryRow[]): ConnectedFactoryRow[] {
  const seen = new Set<number>();
  return rows.filter((row) => {
    const id = Number(row.connected_point_id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function listPendingRequestCounts(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = (await buildPendingRequestCountsQuery(ids)) as PendingCountRow[];
  return new Map(rows.map((row) => [Number(row.eligible_factory_id), Number(row.total)]));
}

async function pendingCountForFactory(eligibleFactoryId: number | string): Promise<number> {
  return (
    (await listPendingRequestCounts([Number(eligibleFactoryId)])).get(Number(eligibleFactoryId)) ??
    0
  );
}

function buildPendingRequestCountsQuery(ids: number[]) {
  return db('poms_factory_edit_requests')
    .whereIn('eligible_factory_id', ids)
    .where('is_open', true)
    .whereNull('deleted_at')
    .groupBy('eligible_factory_id')
    .select('eligible_factory_id')
    .count({ total: 'id' });
}

async function hydrateEditRequests(
  rows: EditRequestRow[],
  executor: DbExecutor,
): Promise<PomsFactoryEditRequestDTO[]> {
  if (rows.length === 0) return [];
  const events = await listEvents(
    executor,
    rows.map((row) => Number(row.id)),
  );
  return rows.map((row) => toEditRequestDTO(row, events.get(Number(row.id)) ?? []));
}

async function hydrateEditRequest(
  row: EditRequestRow,
  executor: DbExecutor,
): Promise<PomsFactoryEditRequestDTO> {
  const [result] = await hydrateEditRequests([row], executor);
  return result;
}

async function requireEditRequestInTransaction(
  trx: Knex.Transaction,
  id: number,
): Promise<PomsFactoryEditRequestDTO> {
  const row = await trx<EditRequestRow>('poms_factory_edit_requests')
    .where('id', id)
    .whereNull('deleted_at')
    .first();
  if (!row) throw new Error('POMS factory edit request could not be reloaded');
  return hydrateEditRequest(row, trx);
}

function toEditRequestDTO(
  row: EditRequestRow,
  events: PomsFactoryEditRequestEventDTO[],
): PomsFactoryEditRequestDTO {
  const proposed = requireProfileSnapshot(row.proposed_factory_json);
  const currentMeasurementPoints =
    row.current_measurement_points_json == null
      ? null
      : requireMeasurementPointSnapshotArray(row.current_measurement_points_json);
  const proposedMeasurementPoints =
    row.proposed_measurement_points_json == null
      ? null
      : requireMeasurementPointSnapshotArray(row.proposed_measurement_points_json);
  return {
    id: Number(row.id),
    requestNo: row.request_no,
    eligibleFactoryId: Number(row.eligible_factory_id),
    factoryId: row.factory_id,
    factoryRegistrationNo: row.factory_registration_no,
    factoryName: proposed.factoryName,
    formType: row.form_type,
    status: row.status,
    statusLabel: POMS_FACTORY_EDIT_REQUEST_STATUS_LABELS[row.status],
    revisionNo: Number(row.revision_no),
    isOpen: Boolean(row.is_open),
    requestNote: row.request_note,
    revisionReason: row.revision_reason,
    officerNote: row.officer_note,
    currentFactory: requireProfileSnapshot(row.current_factory_json),
    proposedFactory: proposed,
    currentMeasurementPoints,
    proposedMeasurementPoints,
    submittedBy: Number(row.submitted_by),
    reviewedBy: toNullableNumber(row.reviewed_by),
    submittedAt: toIsoStringRequired(row.submitted_at),
    reviewedAt: toNullableIsoString(row.reviewed_at),
    approvedAt: toNullableIsoString(row.approved_at),
    createdBy: Number(row.created_by),
    createdAt: toIsoStringRequired(row.created_at),
    updatedAt: toIsoStringRequired(row.updated_at),
    events,
  };
}

async function listEvents(
  executor: DbExecutor,
  requestIds: number[],
): Promise<Map<number, PomsFactoryEditRequestEventDTO[]>> {
  const rows = await executor<EditRequestEventRow>('poms_factory_edit_request_events')
    .whereIn('request_id', requestIds)
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc');
  const map = new Map<number, PomsFactoryEditRequestEventDTO[]>();
  rows.forEach((row) => {
    const requestId = Number(row.request_id);
    map.set(requestId, [
      ...(map.get(requestId) ?? []),
      {
        id: Number(row.id),
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        note: row.event_note,
        actorUserId: Number(row.actor_user_id),
        createdAt: toIsoStringRequired(row.created_at),
      },
    ]);
  });
  return map;
}

async function insertEvent(
  trx: Knex.Transaction,
  input: {
    requestId: number;
    action: PomsFactoryEditRequestAction;
    fromStatus: PomsFactoryEditRequestStatus | null;
    toStatus: PomsFactoryEditRequestStatus;
    note: string | null;
    actorUserId: number;
    snapshot: Record<string, unknown> | PomsFactoryProfileDTO;
  },
): Promise<void> {
  await trx('poms_factory_edit_request_events').insert({
    request_id: input.requestId,
    action: input.action,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    event_note: input.note,
    factory_snapshot_json: JSON.stringify(input.snapshot),
    actor_user_id: input.actorUserId,
    created_by: input.actorUserId,
    updated_by: input.actorUserId,
  });
}

function reviewTransition(input: ReviewPomsFactoryEditRequestInput): {
  status: PomsFactoryEditRequestStatus;
  isOpen: boolean;
} {
  switch (input.decision) {
    case POMS_FACTORY_EDIT_REQUEST_ACTION.APPROVE:
      return { status: POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED, isOpen: false };
    case POMS_FACTORY_EDIT_REQUEST_ACTION.REQUEST_REVISION:
      return { status: POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED, isOpen: true };
    case POMS_FACTORY_EDIT_REQUEST_ACTION.REJECT:
      return { status: POMS_FACTORY_EDIT_REQUEST_STATUS.REJECTED, isOpen: false };
  }
}

function ensureSameProfileVersion(expected: string, current: string): void {
  if (toIsoStringRequired(expected) !== toIsoStringRequired(current)) {
    throw new ConflictError('POMS factory profile changed after the edit request was prepared', {
      expectedUpdatedAt: expected,
      currentUpdatedAt: current,
    });
  }
}

function requireProfileSnapshot(value: string): PomsFactoryProfileDTO {
  const parsed = parseJsonObject<PomsFactoryProfileDTO>(value);
  if (
    !parsed ||
    typeof parsed.factoryName !== 'string' ||
    !Number.isInteger(parsed.eligibleFactoryId) ||
    typeof parsed.factoryId !== 'string'
  ) {
    throw new ConflictError('Stored POMS factory profile snapshot is invalid');
  }
  return parsed;
}

function requireMeasurementPointSnapshotArray(value: string | null): PomsMeasurementPointDTO[] {
  if (value == null) {
    throw new ConflictError('Stored POMS measurement-point snapshot is missing');
  }
  const parsed = parseJsonArray<PomsMeasurementPointDTO>(value);
  if (
    parsed.length === 0 ||
    !parsed.every(
      (point) =>
        Number.isInteger(point?.connectedPointId) &&
        typeof point?.pointName === 'string' &&
        Array.isArray(point?.parameters),
    )
  ) {
    throw new ConflictError('Stored POMS measurement-point snapshot is invalid');
  }
  if (new Set(parsed.map((point) => point.connectedPointId)).size !== parsed.length) {
    throw new ConflictError('Stored POMS measurement-point snapshot contains duplicate points');
  }
  return parsed;
}

function ensureSameMeasurementPointsVersion(
  expected: PomsMeasurementPointDTO[],
  current: PomsMeasurementPointDTO[],
): void {
  if (expected.length !== current.length) {
    throw new ConflictError(
      'POMS factory measurement points changed after the edit request was prepared',
    );
  }

  const normalize = (points: PomsMeasurementPointDTO[]) =>
    [...points]
      .sort((left, right) => left.connectedPointId - right.connectedPointId)
      .map((point) => ({
        connectedPointId: point.connectedPointId,
        pointName: point.pointName,
        pointCode: point.pointCode,
        pointType: point.pointType,
        parameters: point.parameters,
        monitoringPointStatus: point.monitoringPointStatus,
        details: point.details,
        documentsAndImages: point.documentsAndImages,
        measurementInstruments: point.measurementInstruments,
        updatedAt: point.updatedAt,
      }));

  if (JSON.stringify(normalize(expected)) !== JSON.stringify(normalize(current))) {
    throw new ConflictError(
      'POMS factory measurement points changed after the edit request was prepared',
    );
  }
}

function buildEventSnapshot(
  payload: EditRequestPayload,
): Record<string, unknown> | PomsFactoryProfileDTO {
  return payload.formType === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS
    ? {
        formType: payload.formType,
        proposedFactory: payload.proposedFactory,
        proposedMeasurementPoints: payload.proposedMeasurementPoints ?? [],
      }
    : payload.proposedFactory;
}

function toStoredEventSnapshot(
  request: EditRequestRow,
): Record<string, unknown> | PomsFactoryProfileDTO {
  if (request.form_type === POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS) {
    return {
      formType: request.form_type,
      proposedFactory: requireProfileSnapshot(request.proposed_factory_json),
      proposedMeasurementPoints: requireMeasurementPointSnapshotArray(
        request.proposed_measurement_points_json,
      ),
    };
  }
  return requireProfileSnapshot(request.proposed_factory_json);
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
}

function createRequestNo(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PFE-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const number = Reflect.get(error, 'number') ?? Reflect.get(error, 'code');
  return Number(number) === 2601 || Number(number) === 2627;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function toIsoStringRequired(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ConflictError('Stored timestamp is invalid');
  return date.toISOString();
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value == null ? null : toIsoStringRequired(value);
}
