import type { Knex } from 'knex';
import { db } from '../../config/database';
import { BadRequestError, ConflictError } from '../../shared/errors/AppError';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { resolveAssignedRegions } from '../auth/regional-access';
import type {
  ListMonitoringPointFormsQuery,
  MonitoringPointAttachmentDTO,
  MonitoringPointFormAccessContext,
  MonitoringPointDTO,
  MonitoringPointFormDTO,
  MonitoringPointFormFactoryInput,
  MonitoringPointFormSummaryDTO,
  MonitoringPointInput,
  MonitoringPointStatus,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';
import { MONITORING_POINT_STATUSES } from './monitoring-point-forms.types';
import {
  parseMonitoringPointAttachmentLinks,
  type MonitoringPointAttachmentLink,
} from './monitoring-point-attachments';
import {
  MONITORING_POINT_ATTACHMENTS_TABLE,
  buildMonitoringPointAttachmentFileAccess,
  hashMonitoringPointAttachmentUploadToken,
  type MonitoringPointAttachmentRow,
} from './monitoring-point-form-attachments.service';

interface MonitoringPointFormRow {
  id: number | string;
  factory_name: string | null;
  factory_registration_no_new: string | null;
  factory_registration_no_old: string | null;
  province_name: string | null;
  factory_type_main: string | null;
  factory_type_sub: string | null;
  operation_status: string | null;
  eia_info: string | null;
  eia_other: string | null;
  project_name: string | null;
  address: string | null;
  business_activity: string | null;
  machinery_horsepower: number | string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MonitoringPointRow {
  id: number | string;
  form_id: number | string;
  system_type: 'CEMS' | 'WPMS';
  point_code: string | null;
  point_name: string | null;
  production_unit_type: string | null;
  production_capacity: string | null;
  cems_installation_required_by: string | null;
  cems_installation_required_other: string | null;
  legal_annex_no: string | null;
  accounting_connection_status: string | null;
  eligible_parameters_json: string;
  exempted_parameters_json: string;
  connected_parameters_json: string;
  pending_parameters_json: string;
  primary_fuel: string | null;
  primary_fuel_other: string | null;
  secondary_fuel: string | null;
  secondary_fuel_other: string | null;
  attachment_links_json: string;
  details_json: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ExistingMonitoringPoint {
  row: MonitoringPointRow;
  attachmentLinks: MonitoringPointAttachmentLink[];
  hasAttachments: boolean;
}

interface MonitoringPointWritePlan {
  input: MonitoringPointInput;
  inputIndex: number;
  existing: ExistingMonitoringPoint | null;
  pointId?: number;
}

interface MonitoringPointFormSummaryRow extends MonitoringPointFormRow {
  point_count: number | string | null;
  cems_point_count: number | string | null;
  wpms_point_count: number | string | null;
}

export const monitoringPointFormsRepository = {
  async list(
    query: ListMonitoringPointFormsQuery,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormSummaryDTO[]> {
    const rows = await buildFormsQuery(query, access)
      .leftJoin('factory_monitoring_points as p', function joinPoints() {
        this.on('p.form_id', '=', 'f.id').andOnNull('p.deleted_at');
      })
      .groupBy(
        'f.id',
        'f.factory_name',
        'f.factory_registration_no_new',
        'f.factory_registration_no_old',
        'f.province_name',
        'f.factory_type_main',
        'f.factory_type_sub',
        'f.operation_status',
        'f.eia_info',
        'f.eia_other',
        'f.project_name',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.latitude',
        'f.longitude',
        'f.created_at',
        'f.updated_at',
      )
      .select<MonitoringPointFormSummaryRow[]>([
        'f.id',
        'f.factory_name',
        'f.factory_registration_no_new',
        'f.factory_registration_no_old',
        'f.province_name',
        'f.factory_type_main',
        'f.factory_type_sub',
        'f.operation_status',
        'f.eia_info',
        'f.eia_other',
        'f.project_name',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.latitude',
        'f.longitude',
        'f.created_at',
        'f.updated_at',
        db.raw('COUNT(p.id) as point_count'),
        db.raw("SUM(CASE WHEN p.system_type = 'CEMS' THEN 1 ELSE 0 END) as cems_point_count"),
        db.raw("SUM(CASE WHEN p.system_type = 'WPMS' THEN 1 ELSE 0 END) as wpms_point_count"),
      ])
      .orderBy('f.updated_at', 'desc')
      .orderBy('f.id', 'desc');

    return rows.map(toSummaryDTO);
  },

  async findById(
    id: number,
    access?: MonitoringPointFormAccessContext,
    trx?: Knex.Transaction,
  ): Promise<MonitoringPointFormDTO | null> {
    const form = access
      ? await buildFormsQuery({}, access, trx ?? db)
          .where('f.id', id)
          .select<MonitoringPointFormRow[]>('f.*')
          .first()
      : await (trx ?? db)<MonitoringPointFormRow>('factory_monitoring_point_forms')
          .where('id', id)
          .whereNull('deleted_at')
          .first();
    if (!form) return null;

    const points = await (trx ?? db)<MonitoringPointRow>('factory_monitoring_points')
      .where('form_id', id)
      .whereNull('deleted_at')
      .orderBy('id', 'asc');
    const attachmentsByPointId = await loadMonitoringPointAttachmentDTOs(
      trx ?? db,
      points.map((point) => Number(point.id)),
    );

    return {
      ...toFormDTO(form),
      points: points.map((point) =>
        toPointDTO(point, attachmentsByPointId.get(Number(point.id)) ?? []),
      ),
    };
  },

  async create(
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO> {
    return db.transaction(async (trx) => {
      const [{ id }] = await trx('factory_monitoring_point_forms')
        .insert(toFormInsertRow(input.factory, actorUserId))
        .returning('id');
      const pointPlans: MonitoringPointWritePlan[] = input.points.map((point, inputIndex) => ({
        input: point,
        inputIndex,
        existing: null,
      }));
      await persistMonitoringPointPlans(trx, Number(id), pointPlans, [], actorUserId);
      await synchronizeMonitoringPointAttachments(trx, pointPlans, actorUserId);
      const created = await this.findById(Number(id), undefined, trx);
      if (!created) throw new Error('Created monitoring point form could not be loaded');
      return created;
    });
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO | null> {
    if (access && !(await this.findById(id, access))) return null;
    return db.transaction(async (trx) => {
      const form = await trx('factory_monitoring_point_forms')
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first('id');
      if (!form) return null;

      const existingPointRows = await trx<MonitoringPointRow>('factory_monitoring_points')
        .where('form_id', id)
        .whereNull('deleted_at')
        .orderBy('id', 'asc')
        .forUpdate();
      const activeAttachmentPointIds = await listPointIdsWithActiveAttachments(
        trx,
        existingPointRows.map((point) => Number(point.id)),
      );
      const existingPoints = existingPointRows.map(toExistingMonitoringPoint);
      existingPoints.forEach((point) => {
        point.hasAttachments = activeAttachmentPointIds.has(Number(point.row.id));
      });
      const { plans, unmatchedExisting } = reconcileMonitoringPointInputs(
        existingPoints,
        input.points,
      );
      assertUnmatchedResourcesCanBeRemoved(unmatchedExisting, plans);

      await trx('factory_monitoring_point_forms')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          ...toFormInsertRow(input.factory, actorUserId),
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });

      await persistMonitoringPointPlans(trx, id, plans, unmatchedExisting, actorUserId);
      await synchronizeMonitoringPointAttachments(trx, plans, actorUserId);

      return this.findById(id, undefined, trx);
    });
  },

  async canAccessFactory(
    factory: MonitoringPointFormFactoryInput,
    access: MonitoringPointFormAccessContext,
  ): Promise<boolean> {
    const scope = toScopeDetails(access.scope);
    if (scope.scope === 'ALL') return true;

    const registration = normalizeLocationValue(factory.factoryRegistrationNoNew);
    if (scope.scope === 'IN_PROVINCE') {
      const selectedProvince = normalizeLocationValue(scope.province);
      const inputProvince = normalizeLocationValue(factory.provinceName);
      return Boolean(
        selectedProvince && inputProvince && sameLocation(selectedProvince, inputProvince),
      );
    }
    if (scope.scope === 'IN_REGION') {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      const province = normalizeLocationValue(factory.provinceName);
      if (regions.length === 0 || !province) return false;
      const row = await db('provinces')
        .where('name_th', province)
        .whereIn('region', regions)
        .first();
      return Boolean(row);
    }
    if (!registration) return false;

    const query = db('factories as f')
      .whereNull('f.deleted_at')
      .where((builder) => {
        builder.where('f.fid', registration).orWhere('f.code', registration);
      });
    if (scope.scope === 'IN_ESTATE') {
      const estate = normalizeLocationValue(scope.estateCode ?? scope.estate);
      if (!estate) return false;
      query
        .join('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
        .whereNull('ie.deleted_at')
        .where((builder) => builder.where('ie.code', estate).orWhere('ie.name_th', estate));
    } else if (scope.scope === 'OWN_FACTORY') {
      applyAssignedFactoryAccessFilter(query, access.actorUserId);
    } else {
      return false;
    }
    return Boolean(await query.select('f.id').first());
  },
};

function buildFormsQuery(
  query: ListMonitoringPointFormsQuery,
  access?: MonitoringPointFormAccessContext,
  executor: Knex | Knex.Transaction = db,
) {
  const builder = executor('factory_monitoring_point_forms as f').whereNull('f.deleted_at');

  if (query.factoryRegistrationNoNew) {
    builder.where('f.factory_registration_no_new', query.factoryRegistrationNoNew);
  }

  if (query.systemType) {
    builder.whereExists(function existsPoint() {
      this.select(db.raw('1'))
        .from('factory_monitoring_points as sp')
        .whereRaw('sp.form_id = f.id')
        .whereNull('sp.deleted_at')
        .where('sp.system_type', query.systemType);
    });
  }

  if (access) applyFormAccessFilter(builder, access);

  return builder;
}

export function buildFormsQueryForTests(
  query: ListMonitoringPointFormsQuery,
  access: MonitoringPointFormAccessContext,
) {
  return buildFormsQuery(query, access);
}

function applyFormAccessFilter(
  builder: Knex.QueryBuilder,
  access: MonitoringPointFormAccessContext,
): void {
  const scope = toScopeDetails(access.scope);
  switch (scope.scope) {
    case 'ALL':
      return;
    case 'IN_REGION': {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      if (regions.length === 0) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.whereExists(function formRegionAccess() {
        this.select(db.raw('1'))
          .from('provinces as pr')
          .whereRaw('pr.name_th = f.province_name')
          .whereIn('pr.region', regions);
      });
      return;
    }
    case 'IN_PROVINCE': {
      const province = normalizeLocationValue(scope.province);
      if (!province) builder.whereRaw('1 = 0');
      else builder.where('f.province_name', province);
      return;
    }
    case 'IN_ESTATE': {
      const estate = normalizeLocationValue(scope.estateCode ?? scope.estate);
      if (!estate) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.whereExists(function formEstateAccess() {
        this.select(db.raw('1'))
          .from('factories as af')
          .join('industrial_estates as ie', 'ie.id', 'af.industrial_estate_id')
          .whereNull('af.deleted_at')
          .whereNull('ie.deleted_at')
          .where(function formFactoryIdentifier() {
            this.whereRaw('af.fid = f.factory_registration_no_new').orWhereRaw(
              'af.code = f.factory_registration_no_new',
            );
          })
          .where((estateBuilder) => {
            estateBuilder.where('ie.code', estate).orWhere('ie.name_th', estate);
          });
      });
      return;
    }
    case 'OWN_FACTORY':
      builder.whereExists(function formOwnerAccess() {
        this.select(db.raw('1'))
          .from('factories')
          .whereNull('factories.deleted_at')
          .where(function formFactoryIdentifier() {
            this.whereRaw('factories.fid = f.factory_registration_no_new').orWhereRaw(
              'factories.code = f.factory_registration_no_new',
            );
          });
        applyAssignedFactoryAccessFilter(this, access.actorUserId, 'factories');
      });
      return;
    default:
      builder.whereRaw('1 = 0');
  }
}

function toScopeDetails(scope: MonitoringPointFormAccessContext['scope']): {
  scope: string | null | undefined;
  region?: string | null;
  province?: string | null;
  estateCode?: string | null;
  estate?: string | null;
} {
  return scope && typeof scope === 'object' ? scope : { scope };
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized && normalized.toLowerCase() !== 'all' ? normalized : null;
}

function sameLocation(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function toExistingMonitoringPoint(row: MonitoringPointRow): ExistingMonitoringPoint {
  return {
    row,
    attachmentLinks: parseMonitoringPointAttachmentLinks(row.attachment_links_json),
    hasAttachments: false,
  };
}

function reconcileMonitoringPointInputs(
  existingPoints: ExistingMonitoringPoint[],
  inputs: MonitoringPointInput[],
): { plans: MonitoringPointWritePlan[]; unmatchedExisting: ExistingMonitoringPoint[] } {
  const plans: Array<MonitoringPointWritePlan | undefined> = inputs.map(() => undefined);
  const existingById = new Map(
    existingPoints.map((point) => [Number(point.row.id), point] as const),
  );
  const matchedExistingIds = new Set<number>();
  const explicitPointIds = new Set<number>();

  inputs.forEach((input, inputIndex) => {
    if (input.id === undefined) return;
    if (explicitPointIds.has(input.id)) {
      throw new BadRequestError('Duplicate monitoring point id in request', {
        pointId: input.id,
        inputIndex,
      });
    }
    explicitPointIds.add(input.id);

    const existing = existingById.get(input.id);
    if (!existing) {
      throw new ConflictError('Monitoring point id does not belong to the active form', {
        pointId: input.id,
        inputIndex,
      });
    }
    matchedExistingIds.add(input.id);
    plans[inputIndex] = { input, inputIndex, existing };
  });

  const unmatchedInputIndexes = () =>
    inputs.flatMap((_input, index) => (plans[index] ? [] : [index]));
  const unmatchedExistingPoints = () =>
    existingPoints.filter((point) => !matchedExistingIds.has(Number(point.row.id)));

  const inputIndexesByKey = groupIndexesByIdentityKey(inputs, unmatchedInputIndexes());
  const existingByKey = groupExistingByIdentityKey(unmatchedExistingPoints());
  for (const [key, inputIndexes] of inputIndexesByKey) {
    const matchingExisting = existingByKey.get(key) ?? [];
    if (inputIndexes.length !== 1 || matchingExisting.length !== 1) continue;

    const inputIndex = inputIndexes[0];
    const existing = matchingExisting[0];
    if (inputIndex === undefined || !existing) continue;
    plans[inputIndex] = {
      input: requireMonitoringPointInput(inputs, inputIndex),
      inputIndex,
      existing,
    };
    matchedExistingIds.add(Number(existing.row.id));
  }

  const remainingInputIndexes = unmatchedInputIndexes();
  const remainingExisting = unmatchedExistingPoints();
  if (canUseGuardedPositionalFallback(inputs, remainingInputIndexes, remainingExisting)) {
    remainingInputIndexes.forEach((inputIndex, position) => {
      const existing = remainingExisting[position];
      if (!existing) return;
      plans[inputIndex] = {
        input: requireMonitoringPointInput(inputs, inputIndex),
        inputIndex,
        existing,
      };
      matchedExistingIds.add(Number(existing.row.id));
    });
  }

  return {
    plans: plans.map(
      (plan, inputIndex): MonitoringPointWritePlan =>
        plan ?? {
          input: requireMonitoringPointInput(inputs, inputIndex),
          inputIndex,
          existing: null,
        },
    ),
    unmatchedExisting: unmatchedExistingPoints(),
  };
}

function groupIndexesByIdentityKey(
  inputs: MonitoringPointInput[],
  indexes: number[],
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const index of indexes) {
    const input = inputs[index];
    if (!input) continue;
    const key = monitoringPointIdentityKey(input.systemType, input.pointCode);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  }
  return groups;
}

function groupExistingByIdentityKey(
  points: ExistingMonitoringPoint[],
): Map<string, ExistingMonitoringPoint[]> {
  const groups = new Map<string, ExistingMonitoringPoint[]>();
  for (const point of points) {
    const key = monitoringPointIdentityKey(point.row.system_type, point.row.point_code);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return groups;
}

function monitoringPointIdentityKey(
  systemType: MonitoringPointInput['systemType'],
  pointCode: string | null | undefined,
): string | null {
  const normalizedCode = normalizeIdentityText(pointCode);
  return normalizedCode ? `${systemType}:${normalizedCode}` : null;
}

function canUseGuardedPositionalFallback(
  inputs: MonitoringPointInput[],
  inputIndexes: number[],
  existingPoints: ExistingMonitoringPoint[],
): boolean {
  if (inputIndexes.length === 0 || inputIndexes.length !== existingPoints.length) return false;
  if (
    inputIndexes.some((index) => {
      const input = inputs[index];
      return !input || input.attachments !== undefined || input.attachmentLinks !== undefined;
    })
  ) {
    return false;
  }

  const inputSignatures = inputIndexes.map((index) =>
    monitoringPointLegacySignatureFromInput(requireMonitoringPointInput(inputs, index)),
  );
  const existingSignatures = existingPoints.map(monitoringPointLegacySignatureFromRow);
  if (new Set(inputSignatures).size !== inputSignatures.length) return false;
  if (new Set(existingSignatures).size !== existingSignatures.length) return false;

  return inputSignatures.every((signature, index) => signature === existingSignatures[index]);
}

function requireMonitoringPointInput(
  inputs: MonitoringPointInput[],
  index: number,
): MonitoringPointInput {
  const input = inputs[index];
  if (!input) throw new Error(`Monitoring point input ${index} is unavailable`);
  return input;
}

function monitoringPointLegacySignatureFromInput(point: MonitoringPointInput): string {
  return monitoringPointLegacySignature(point.systemType, point.pointCode, point.pointName);
}

function monitoringPointLegacySignatureFromRow(point: ExistingMonitoringPoint): string {
  return monitoringPointLegacySignature(
    point.row.system_type,
    point.row.point_code,
    point.row.point_name,
  );
}

function monitoringPointLegacySignature(
  systemType: MonitoringPointInput['systemType'],
  pointCode: string | null | undefined,
  pointName: string | null | undefined,
): string {
  return `${systemType}:${normalizeIdentityText(pointCode) ?? ''}:${normalizeIdentityText(pointName) ?? ''}`;
}

function normalizeIdentityText(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase('th-TH') ?? '';
  return normalized || null;
}

function assertUnmatchedResourcesCanBeRemoved(
  unmatchedExisting: ExistingMonitoringPoint[],
  plans: MonitoringPointWritePlan[],
): void {
  if (unmatchedExisting.length === 0) return;
  if (plans.length === 0) return;
  const matchedExistingPlans = plans.filter((plan) => plan.existing !== null);
  if (
    matchedExistingPlans.length > 0 &&
    matchedExistingPlans.every((plan) => plan.input.id !== undefined)
  ) {
    return;
  }
  const protectedPointIds = unmatchedExisting.flatMap((point) => {
    return point.hasAttachments || point.attachmentLinks.length > 0 ? [Number(point.row.id)] : [];
  });
  if (protectedPointIds.length === 0) return;

  throw new ConflictError(
    'Monitoring point identity is ambiguous; include point ids before changing resource-bearing points',
    { pointIds: protectedPointIds },
  );
}

async function persistMonitoringPointPlans(
  trx: Knex.Transaction,
  formId: number,
  plans: MonitoringPointWritePlan[],
  unmatchedExisting: ExistingMonitoringPoint[],
  actorUserId: number,
): Promise<void> {
  for (const plan of plans) {
    const attachmentLinks = plan.input.attachmentLinks ?? plan.existing?.attachmentLinks ?? [];
    const row = toPointPersistenceRow(plan.input, attachmentLinks);

    if (plan.existing) {
      const pointId = Number(plan.existing.row.id);
      const affected = await trx('factory_monitoring_points')
        .where('id', pointId)
        .where('form_id', formId)
        .whereNull('deleted_at')
        .update({
          ...row,
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });
      if (affected !== 1) {
        throw new ConflictError('Monitoring point changed during update', { pointId });
      }
      plan.pointId = pointId;
      continue;
    }

    const [{ id }] = await trx('factory_monitoring_points')
      .insert({
        form_id: formId,
        ...row,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .returning('id');
    plan.pointId = Number(id);
  }

  const removedPointIds = unmatchedExisting.map((point) => Number(point.row.id));
  if (removedPointIds.length === 0) return;
  const deletedAt = trx.fn.now();
  await trx('factory_monitoring_point_attachments')
    .whereIn('monitoring_point_id', removedPointIds)
    .whereNull('deleted_at')
    .update({ deleted_at: deletedAt, updated_at: deletedAt, updated_by: actorUserId });
  await trx('factory_monitoring_points')
    .where('form_id', formId)
    .whereIn('id', removedPointIds)
    .whereNull('deleted_at')
    .update({ deleted_at: deletedAt, updated_at: deletedAt, updated_by: actorUserId });
}

interface AttachmentReferenceTarget {
  plan: MonitoringPointWritePlan;
  reference: NonNullable<MonitoringPointInput['attachments']>[number];
  sortOrder: number;
}

async function synchronizeMonitoringPointAttachments(
  trx: Knex.Transaction,
  plans: MonitoringPointWritePlan[],
  actorUserId: number,
): Promise<void> {
  const explicitPlans = plans.filter((plan) => plan.input.attachments !== undefined);
  if (explicitPlans.length === 0) return;

  const targets: AttachmentReferenceTarget[] = explicitPlans.flatMap((plan) =>
    (plan.input.attachments ?? []).map((reference, index) => ({
      plan,
      reference,
      sortOrder: index + 1,
    })),
  );
  assertUniqueAttachmentReferences(targets);

  const pointIds = explicitPlans.map(requirePlanPointId);
  const activeRows = await loadActiveAttachmentRowsForPointIds(trx, pointIds, true);
  const activeRowsById = new Map(activeRows.map((row) => [Number(row.id), row] as const));
  const tokenTargets = targets.filter(
    (target): target is AttachmentReferenceTarget & { reference: { uploadToken: string } } =>
      target.reference.uploadToken !== undefined,
  );
  const tokenRowsByHash = await loadAttachmentRowsByTokenHashes(
    trx,
    tokenTargets.map((target) =>
      hashMonitoringPointAttachmentUploadToken(target.reference.uploadToken),
    ),
  );
  const now = new Date();

  for (const target of targets) {
    const pointId = requirePlanPointId(target.plan);
    if (target.reference.id !== undefined) {
      const row = activeRowsById.get(target.reference.id);
      if (
        !row ||
        row.monitoring_point_id === null ||
        Number(row.monitoring_point_id) !== pointId ||
        row.claimed_at === null
      ) {
        throw new ConflictError('Attachment id does not belong to the monitoring point', {
          attachmentId: target.reference.id,
          pointId,
        });
      }
      continue;
    }

    const tokenHash = hashMonitoringPointAttachmentUploadToken(target.reference.uploadToken);
    const row = tokenRowsByHash.get(bufferKey(tokenHash));
    if (
      !row ||
      row.monitoring_point_id !== null ||
      row.claimed_at !== null ||
      Number(row.created_by) !== actorUserId ||
      new Date(row.expires_at).getTime() <= now.getTime()
    ) {
      throw new ConflictError('Attachment upload token is invalid or unavailable');
    }
  }

  const activeRowsByPointId = groupAttachmentRowsByPointId(activeRows);
  for (const plan of explicitPlans) {
    const pointId = requirePlanPointId(plan);
    const planTargets = targets.filter((target) => target.plan === plan);
    const retainedIds = new Set(
      planTargets.flatMap((target) =>
        target.reference.id === undefined ? [] : [target.reference.id],
      ),
    );
    const removedIds = (activeRowsByPointId.get(pointId) ?? []).flatMap((row) =>
      retainedIds.has(Number(row.id)) ? [] : [Number(row.id)],
    );
    if (removedIds.length > 0) {
      await trx(MONITORING_POINT_ATTACHMENTS_TABLE)
        .whereIn('id', removedIds)
        .where('monitoring_point_id', pointId)
        .whereNull('deleted_at')
        .update({
          deleted_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });
    }

    for (const target of planTargets) {
      if (target.reference.id !== undefined) {
        const affected = await trx(MONITORING_POINT_ATTACHMENTS_TABLE)
          .where('id', target.reference.id)
          .where('monitoring_point_id', pointId)
          .whereNotNull('claimed_at')
          .whereNull('deleted_at')
          .update({
            sort_order: target.sortOrder,
            updated_at: trx.fn.now(),
            updated_by: actorUserId,
          });
        if (affected !== 1) {
          throw new ConflictError('Attachment changed during monitoring point update', {
            attachmentId: target.reference.id,
            pointId,
          });
        }
        continue;
      }

      const tokenHash = hashMonitoringPointAttachmentUploadToken(target.reference.uploadToken);
      const tokenRow = tokenRowsByHash.get(bufferKey(tokenHash));
      if (!tokenRow) {
        throw new ConflictError('Attachment upload token is invalid or unavailable');
      }
      const affected = await trx(MONITORING_POINT_ATTACHMENTS_TABLE)
        .where('id', tokenRow.id)
        .where('claim_token_hash', tokenHash)
        .where('created_by', actorUserId)
        .whereNull('monitoring_point_id')
        .whereNull('claimed_at')
        .whereNull('deleted_at')
        .where('expires_at', '>', now)
        .update({
          monitoring_point_id: pointId,
          sort_order: target.sortOrder,
          claimed_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });
      if (affected !== 1) {
        throw new ConflictError('Attachment upload token is invalid or unavailable');
      }
    }
  }
}

function assertUniqueAttachmentReferences(targets: AttachmentReferenceTarget[]): void {
  const seen = new Set<string>();
  for (const target of targets) {
    const key =
      target.reference.id !== undefined
        ? `id:${target.reference.id}`
        : `token:${target.reference.uploadToken}`;
    if (seen.has(key)) {
      throw new BadRequestError('Duplicate attachment reference in request', { reference: key });
    }
    seen.add(key);
  }
}

function requirePlanPointId(plan: MonitoringPointWritePlan): number {
  if (plan.pointId === undefined) {
    throw new Error(`Monitoring point ${plan.inputIndex} was not persisted`);
  }
  return plan.pointId;
}

function groupAttachmentRowsByPointId(
  rows: MonitoringPointAttachmentRow[],
): Map<number, MonitoringPointAttachmentRow[]> {
  const result = new Map<number, MonitoringPointAttachmentRow[]>();
  for (const row of rows) {
    if (row.monitoring_point_id === null) continue;
    const pointId = Number(row.monitoring_point_id);
    result.set(pointId, [...(result.get(pointId) ?? []), row]);
  }
  return result;
}

async function loadAttachmentRowsByTokenHashes(
  trx: Knex.Transaction,
  tokenHashes: Buffer[],
): Promise<Map<string, MonitoringPointAttachmentRow>> {
  const rows: MonitoringPointAttachmentRow[] = [];
  for (const hashChunk of chunkValues(tokenHashes)) {
    rows.push(
      ...(await trx<MonitoringPointAttachmentRow>(MONITORING_POINT_ATTACHMENTS_TABLE)
        .whereIn('claim_token_hash', hashChunk)
        .whereNull('deleted_at')
        .forUpdate()),
    );
  }
  return new Map(rows.map((row) => [bufferKey(row.claim_token_hash), row] as const));
}

function bufferKey(value: Buffer): string {
  return value.toString('hex');
}

async function listPointIdsWithActiveAttachments(
  executor: Knex | Knex.Transaction,
  pointIds: number[],
): Promise<Set<number>> {
  const rows = await loadActiveAttachmentRowsForPointIds(executor, pointIds, true);
  return new Set(
    rows.flatMap((row) =>
      row.monitoring_point_id === null ? [] : [Number(row.monitoring_point_id)],
    ),
  );
}

async function loadActiveAttachmentRowsForPointIds(
  executor: Knex | Knex.Transaction,
  pointIds: number[],
  lockRows: boolean,
): Promise<MonitoringPointAttachmentRow[]> {
  const rows: MonitoringPointAttachmentRow[] = [];
  for (const pointIdChunk of chunkValues(Array.from(new Set(pointIds)))) {
    let query = executor<MonitoringPointAttachmentRow>(MONITORING_POINT_ATTACHMENTS_TABLE)
      .whereIn('monitoring_point_id', pointIdChunk)
      .whereNotNull('claimed_at')
      .whereNull('deleted_at');
    if (lockRows) query = query.forUpdate();
    rows.push(...(await query));
  }
  return rows;
}

export async function loadMonitoringPointAttachmentDTOs(
  executor: Knex | Knex.Transaction,
  pointIds: number[],
): Promise<Map<number, MonitoringPointAttachmentDTO[]>> {
  const rows = await loadActiveAttachmentRowsForPointIds(executor, pointIds, false);
  rows.sort((left, right) => {
    const pointDifference = Number(left.monitoring_point_id) - Number(right.monitoring_point_id);
    if (pointDifference !== 0) return pointDifference;
    const orderDifference = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
    return orderDifference !== 0 ? orderDifference : Number(left.id) - Number(right.id);
  });

  const result = new Map<number, MonitoringPointAttachmentDTO[]>();
  const now = new Date();
  for (const row of rows) {
    if (row.monitoring_point_id === null) continue;
    const pointId = Number(row.monitoring_point_id);
    const attachment = toMonitoringPointAttachmentDTO(row, now);
    result.set(pointId, [...(result.get(pointId) ?? []), attachment]);
  }
  return result;
}

function toMonitoringPointAttachmentDTO(
  row: MonitoringPointAttachmentRow,
  now: Date,
): MonitoringPointAttachmentDTO {
  return {
    id: Number(row.id),
    fileName: row.original_file_name,
    ...buildMonitoringPointAttachmentFileAccess(row.public_id, now),
    fileType: row.mime_type,
    fileSize: Number(row.file_size),
  };
}

function chunkValues<T>(values: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function toFormInsertRow(
  factory: MonitoringPointFormFactoryInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    factory_name: factory.factoryName ?? null,
    factory_registration_no_new: factory.factoryRegistrationNoNew ?? null,
    factory_registration_no_old: factory.factoryRegistrationNoOld ?? null,
    province_name: factory.provinceName ?? null,
    factory_type_main: factory.factoryTypeMain ?? null,
    factory_type_sub: factory.factoryTypeSub ?? null,
    operation_status: factory.operationStatus ?? null,
    eia_info: factory.eiaInfo ?? null,
    eia_other: factory.eiaOther ?? null,
    project_name: factory.projectName ?? null,
    address: factory.address ?? null,
    business_activity: factory.businessActivity ?? null,
    machinery_horsepower: factory.machineryHorsepower ?? null,
    latitude: factory.latitude ?? null,
    longitude: factory.longitude ?? null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toPointPersistenceRow(
  point: MonitoringPointInput,
  attachmentLinks: MonitoringPointAttachmentLink[],
): Record<string, unknown> {
  const details = {
    ...(stripAttachmentFields(point.details) ?? {}),
    timeSharingParameters: point.timeSharingParameters ?? [],
    sharedStackCode: point.timeSharingParameters?.includes('ไม่มี')
      ? null
      : (point.sharedStackCode ?? null),
    monitoringPointStatus: point.monitoringPointStatus ?? null,
  };

  return {
    system_type: point.systemType,
    point_code: point.pointCode ?? null,
    point_name: point.pointName ?? null,
    production_unit_type: point.productionUnitType ?? null,
    production_capacity: point.productionCapacity ?? null,
    cems_installation_required_by: point.cemsInstallationRequiredBy ?? null,
    cems_installation_required_other: point.cemsInstallationRequiredOther ?? null,
    legal_annex_no: formatStringList(point.legalAnnexNo),
    accounting_connection_status: point.accountingConnectionStatus ?? null,
    eligible_parameters_json: JSON.stringify(point.eligibleParameters ?? []),
    exempted_parameters_json: JSON.stringify(point.exemptedParameters ?? []),
    connected_parameters_json: JSON.stringify(point.connectedParameters ?? []),
    pending_parameters_json: JSON.stringify(point.pendingParameters ?? []),
    primary_fuel: point.primaryFuel ?? null,
    primary_fuel_other: point.primaryFuelOther ?? null,
    secondary_fuel: point.secondaryFuel ?? null,
    secondary_fuel_other: point.secondaryFuelOther ?? null,
    attachment_links_json: JSON.stringify(attachmentLinks),
    details_json: JSON.stringify(details),
  };
}

function toFormDTO(row: MonitoringPointFormRow): Omit<MonitoringPointFormDTO, 'points'> {
  return {
    id: Number(row.id),
    factory: toFactoryDTO(row),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toSummaryDTO(row: MonitoringPointFormSummaryRow): MonitoringPointFormSummaryDTO {
  return {
    ...toFormDTO(row),
    pointCount: Number(row.point_count ?? 0),
    cemsPointCount: Number(row.cems_point_count ?? 0),
    wpmsPointCount: Number(row.wpms_point_count ?? 0),
  };
}

function toFactoryDTO(row: MonitoringPointFormRow): Required<MonitoringPointFormFactoryInput> {
  return {
    factoryName: row.factory_name,
    factoryRegistrationNoNew: row.factory_registration_no_new,
    factoryRegistrationNoOld: row.factory_registration_no_old,
    provinceName: row.province_name,
    factoryTypeMain: row.factory_type_main,
    factoryTypeSub: row.factory_type_sub,
    operationStatus: row.operation_status,
    eiaInfo: row.eia_info,
    eiaOther: row.eia_other,
    projectName: row.project_name,
    address: row.address,
    businessActivity: row.business_activity,
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
  };
}

function toPointDTO(
  row: MonitoringPointRow,
  attachments: MonitoringPointAttachmentDTO[],
): MonitoringPointDTO {
  const storedDetails = parseObject(row.details_json);
  const details = stripAttachmentFields(storedDetails);
  const timeSharingParameters = parseStoredStringList(storedDetails?.timeSharingParameters);

  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    systemType: row.system_type,
    pointCode: row.point_code,
    pointName: row.point_name,
    productionUnitType: row.production_unit_type,
    productionCapacity: row.production_capacity,
    cemsInstallationRequiredBy: row.cems_installation_required_by,
    cemsInstallationRequiredOther: row.cems_installation_required_other,
    legalAnnexNo: parseDelimitedStringList(row.legal_annex_no),
    accountingConnectionStatus: row.accounting_connection_status,
    eligibleParameters: parseStringList(row.eligible_parameters_json),
    exemptedParameters: parseStringList(row.exempted_parameters_json),
    connectedParameters: parseStringList(row.connected_parameters_json),
    pendingParameters: parseStringList(row.pending_parameters_json),
    timeSharingParameters,
    sharedStackCode: timeSharingParameters.includes('ไม่มี')
      ? null
      : parseNullableString(storedDetails?.sharedStackCode),
    monitoringPointStatus: parseMonitoringPointStatus(storedDetails?.monitoringPointStatus),
    attachmentLinks: parseMonitoringPointAttachmentLinks(row.attachment_links_json),
    attachments,
    primaryFuel: row.primary_fuel,
    primaryFuelOther: row.primary_fuel_other,
    secondaryFuel: row.secondary_fuel,
    secondaryFuelOther: row.secondary_fuel_other,
    details,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function stripAttachmentFields(
  details: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!details) return null;
  const sanitized = { ...details };
  delete sanitized.attachmentLinks;
  delete sanitized.attachments;
  return sanitized;
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseStoredStringList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function parseMonitoringPointStatus(value: unknown): MonitoringPointStatus | null {
  return MONITORING_POINT_STATUSES.find((status) => status === value) ?? null;
}

function parseDelimitedStringList(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }
  } catch {
    // Fall back to the legacy comma-separated format below.
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatStringList(value: string[] | undefined): string | null {
  if (!value?.length) return null;
  return (
    value
      .map((item) => item.trim())
      .filter(Boolean)
      .join(',') || null
  );
}

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return Number(value);
}
