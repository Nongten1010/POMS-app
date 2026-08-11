import type { Knex } from 'knex';
import { db } from '../../config/database';
import { ConflictError } from '../../shared/errors/AppError';
import type { EligibleFactoryAccessContext } from './eligible-factories.access';
import {
  applySelectedFactoryAccessFilters,
  canAccessEligibleFactoryInput,
  resolveSelectedFactoryAccessFilters,
} from './eligible-factories.access';
import {
  MONITORING_POINT_STATUSES,
  type MonitoringPointStatus,
} from '../monitoring-point-forms/monitoring-point-forms.types';
import { parseMonitoringPointAttachmentLinks } from '../monitoring-point-forms/monitoring-point-attachments';
import { loadMonitoringPointAttachmentDTOs } from '../monitoring-point-forms/monitoring-point-forms.repository';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  EligibleFactoryMeasurementPointDTO,
  ListEligibleFactoriesQuery,
} from './eligible-factories.types';
import { hydrateEligibleFactoriesFromSource } from './eligible-factory-source-hydration';

interface EligibleFactoryRow {
  id: number | string;
  source_system: string;
  source_factory_id: string | null;
  monitoring_point_form_id: number | string | null;
  factory_registration_no_new: string;
  factory_registration_no_old: string | null;
  factory_name: string;
  factory_type_sequence: string | null;
  address: string | null;
  province_name: string;
  industrial_estate_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  operation_status: string;
  capital_amount: number | string | null;
  machinery_horsepower: number | string | null;
  production_capacity: string | null;
  wastewater_discharge_info: string | null;
  boiler_count: number | string | null;
  boiler_size_each: string | null;
  fuel_used: string | null;
  eia_assessment: string | null;
  eia_other: string | null;
  has_eia: boolean | number | null;
  project_name: string | null;
  selected_reason: string | null;
  selected_by: number | string;
  selected_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface EligibleFactoryMonitoringPointRow {
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
}

export const eligibleFactoriesRepository = {
  async list(
    _query: ListEligibleFactoriesQuery,
    access?: EligibleFactoryAccessContext,
  ): Promise<{ rows: EligibleFactoryDTO[]; total: number }> {
    const filters = await resolveSelectedFactoryAccessFilters(access);
    const baseQuery = buildEligibleFactoriesBaseQuery(filters, access?.actorUserId);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('ef.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rowsQuery = baseQuery.clone().orderBy('selected_at', 'desc').orderBy('id', 'desc');

    const rows = await rowsQuery;
    const factories = await hydrateEligibleFactoriesFromSource(rows.map(toDTO));
    return { rows: await hydrateMeasurementPoints(factories), total };
  },

  async findByRegistrationNoNew(registrationNoNew: string): Promise<{
    id: number;
    factoryRegistrationNoNew: string;
    monitoringPointFormId: number | null;
  } | null> {
    const row = await db('eligible_factories')
      .where('factory_registration_no_new', registrationNoNew)
      .whereNull('deleted_at')
      .select('id', 'factory_registration_no_new', 'monitoring_point_form_id')
      .first();

    if (!row) return null;
    return {
      id: Number(row.id),
      factoryRegistrationNoNew: row.factory_registration_no_new,
      monitoringPointFormId:
        row.monitoring_point_form_id === null || row.monitoring_point_form_id === undefined
          ? null
          : Number(row.monitoring_point_form_id),
    };
  },

  async findByMonitoringPointFormId(formId: number): Promise<EligibleFactoryDTO | null> {
    const row = await db<EligibleFactoryRow>('eligible_factories')
      .where('monitoring_point_form_id', formId)
      .whereNull('deleted_at')
      .first();

    return row ? toDTO(row) : null;
  },

  async create(
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO> {
    const restored = await restoreDeletedFactory(input, actorUserId);
    if (restored) return restored;

    const [{ id }] = await db('eligible_factories')
      .insert(toInsertRow(input, actorUserId))
      .returning('id');
    const created = await this.findById(Number(id));
    if (!created) throw new Error('Created eligible factory could not be loaded');
    return created;
  },

  async findById(id: number, trx?: Knex.Transaction): Promise<EligibleFactoryDTO | null> {
    const row = await (trx ?? db)<EligibleFactoryRow>('eligible_factories')
      .where('id', id)
      .whereNull('deleted_at')
      .first();
    return row ? toDTO(row) : null;
  },

  async findAccessibleById(
    id: number,
    access: EligibleFactoryAccessContext,
    trx?: Knex.Transaction,
  ): Promise<EligibleFactoryDTO | null> {
    const filters = await resolveSelectedFactoryAccessFilters(access);
    const row = await buildEligibleFactoriesBaseQuery(filters, access.actorUserId, trx)
      .where('ef.id', id)
      .first();
    return row ? toDTO(row) : null;
  },

  async listActiveRegistrationNumbers(access?: EligibleFactoryAccessContext): Promise<string[]> {
    const filters = await resolveSelectedFactoryAccessFilters(access);
    const query = buildEligibleFactoriesBaseQuery(filters, access?.actorUserId)
      .clearSelect()
      .clearOrder()
      .select<{ factory_registration_no_new: string }[]>('ef.factory_registration_no_new');

    const rows = await query;

    return rows.map((row) => row.factory_registration_no_new);
  },

  async softDelete(id: number, actorUserId: number): Promise<boolean> {
    return db.transaction((trx) => performSoftDelete(trx, id, actorUserId));
  },

  async softDeleteAccessible(
    id: number,
    actorUserId: number,
    access: EligibleFactoryAccessContext,
  ): Promise<boolean> {
    return db.transaction(async (trx) => {
      const visible = await this.findAccessibleById(id, access, trx);
      if (!visible) return false;
      return performSoftDelete(trx, id, actorUserId);
    });
  },

  async canAccessInput(
    input: CreateEligibleFactoryInput,
    access: EligibleFactoryAccessContext,
  ): Promise<boolean> {
    return canAccessEligibleFactoryInput(input, access);
  },

  async attachMonitoringPointForm(
    eligibleFactoryId: number,
    formId: number,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO | null> {
    await db('eligible_factories').where('id', eligibleFactoryId).whereNull('deleted_at').update({
      monitoring_point_form_id: formId,
      updated_at: db.fn.now(),
      updated_by: actorUserId,
    });

    return this.findById(eligibleFactoryId);
  },

  async updateFromMonitoringPointForm(
    eligibleFactoryId: number,
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO | null> {
    await db('eligible_factories')
      .where('id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        ...toMonitoringPointFormUpdateRow(input),
        updated_at: db.fn.now(),
        updated_by: actorUserId,
      });

    return this.findById(eligibleFactoryId);
  },
};

function buildEligibleFactoriesBaseQuery(
  filters: Awaited<ReturnType<typeof resolveSelectedFactoryAccessFilters>>,
  actorUserId: number | undefined,
  trx?: Knex.Transaction,
): Knex.QueryBuilder<EligibleFactoryRow, EligibleFactoryRow[]> {
  const builder = (trx ?? db)<EligibleFactoryRow>('eligible_factories as ef')
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin('industrial_estates as ie', 'ie.name_th', 'ef.industrial_estate_name')
    .whereNull('ef.deleted_at');

  applySelectedFactoryAccessFilters(builder, filters, actorUserId);

  return builder.select(
    'ef.id as id',
    'ef.source_system as source_system',
    'ef.source_factory_id as source_factory_id',
    'ef.monitoring_point_form_id as monitoring_point_form_id',
    'ef.factory_registration_no_new as factory_registration_no_new',
    'ef.factory_registration_no_old as factory_registration_no_old',
    'ef.factory_name as factory_name',
    'ef.factory_type_sequence as factory_type_sequence',
    'ef.address as address',
    'ef.province_name as province_name',
    'ef.industrial_estate_name as industrial_estate_name',
    'ef.latitude as latitude',
    'ef.longitude as longitude',
    'ef.business_activity as business_activity',
    'ef.operation_status as operation_status',
    'ef.capital_amount as capital_amount',
    'ef.machinery_horsepower as machinery_horsepower',
    'ef.production_capacity as production_capacity',
    'ef.wastewater_discharge_info as wastewater_discharge_info',
    'ef.boiler_count as boiler_count',
    'ef.boiler_size_each as boiler_size_each',
    'ef.fuel_used as fuel_used',
    'ef.eia_assessment as eia_assessment',
    'ef.eia_other as eia_other',
    'ef.has_eia as has_eia',
    'ef.project_name as project_name',
    'ef.selected_reason as selected_reason',
    'ef.selected_by as selected_by',
    'ef.selected_at as selected_at',
    'ef.created_at as created_at',
    'ef.updated_at as updated_at',
  );
}

async function performSoftDelete(
  trx: Knex.Transaction,
  id: number,
  actorUserId: number,
): Promise<boolean> {
  const eligibleFactory = await trx('eligible_factories')
    .where('id', id)
    .whereNull('deleted_at')
    .forUpdate()
    .first('id', 'monitoring_point_form_id');
  if (!eligibleFactory) return false;

  const monitoringPointFormId =
    eligibleFactory.monitoring_point_form_id === null ||
    eligibleFactory.monitoring_point_form_id === undefined
      ? null
      : Number(eligibleFactory.monitoring_point_form_id);
  const connectedPointQuery = trx('cems_wpms_connected_measurement_points');

  if (monitoringPointFormId === null) {
    connectedPointQuery.where('cems_wpms_connected_measurement_points.eligible_factory_id', id);
  } else {
    connectedPointQuery
      .innerJoin(
        'eligible_factories as linked_eligible',
        'linked_eligible.id',
        'cems_wpms_connected_measurement_points.eligible_factory_id',
      )
      .where('linked_eligible.monitoring_point_form_id', monitoringPointFormId);
  }

  const connectedPoint = await connectedPointQuery
    .whereNull('cems_wpms_connected_measurement_points.deleted_at')
    .forUpdate()
    .first('cems_wpms_connected_measurement_points.id');
  if (connectedPoint) {
    throw new ConflictError('Connected POMS factory cannot be removed from eligible factories', {
      eligibleFactoryId: id,
    });
  }

  const deletedAt = trx.fn.now();
  const softDeleteAudit = {
    deleted_at: deletedAt,
    updated_at: deletedAt,
    updated_by: actorUserId,
  };

  if (monitoringPointFormId !== null) {
    await trx('factory_monitoring_point_forms')
      .where('id', monitoringPointFormId)
      .whereNull('deleted_at')
      .update(softDeleteAudit);
    await trx('factory_monitoring_points')
      .where('form_id', monitoringPointFormId)
      .whereNull('deleted_at')
      .update(softDeleteAudit);
  }

  const affected = await trx('eligible_factories')
    .where('id', id)
    .whereNull('deleted_at')
    .update(softDeleteAudit);

  return affected > 0;
}

async function restoreDeletedFactory(
  input: CreateEligibleFactoryInput,
  actorUserId: number,
): Promise<EligibleFactoryDTO | null> {
  const existingDeleted = await db('eligible_factories')
    .where('factory_registration_no_new', input.factoryRegistrationNoNew)
    .whereNotNull('deleted_at')
    .select<{ id: number | string }[]>('id')
    .first();

  if (!existingDeleted) return null;

  await db('eligible_factories')
    .where('id', existingDeleted.id)
    .update({
      ...toInsertRow(input, actorUserId),
      deleted_at: null,
      selected_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

  return eligibleFactoriesRepository.findById(Number(existingDeleted.id));
}

function toInsertRow(
  input: CreateEligibleFactoryInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    source_system: input.sourceSystem ?? 'external_factory_db',
    source_factory_id: input.sourceFactoryId ?? null,
    monitoring_point_form_id: input.monitoringPointFormId ?? null,
    factory_registration_no_new: input.factoryRegistrationNoNew,
    factory_registration_no_old: input.factoryRegistrationNoOld ?? null,
    factory_name: input.factoryName,
    factory_type_sequence: input.factoryTypeSequence ?? null,
    address: input.address ?? null,
    province_name: input.provinceName,
    ...(input.industrialEstateName !== undefined
      ? { industrial_estate_name: input.industrialEstateName }
      : {}),
    latitude: input.coordinates?.latitude ?? null,
    longitude: input.coordinates?.longitude ?? null,
    business_activity: input.businessActivity ?? null,
    operation_status: input.operationStatus,
    capital_amount: input.capitalAmount ?? null,
    machinery_horsepower: input.machineryHorsepower ?? null,
    production_capacity: input.productionCapacity ?? null,
    wastewater_discharge_info: input.wastewaterDischargeInfo ?? null,
    boiler_count: input.boilerCount ?? null,
    boiler_size_each: input.boilerSizeEach ?? null,
    fuel_used: input.fuelUsed ?? null,
    eia_assessment: input.eia ?? null,
    eia_other: input.eia === 'อื่นๆ' ? (input.eiaOther ?? null) : null,
    has_eia: input.hasEia ?? null,
    project_name: input.projectName ?? null,
    selected_reason: input.selectedReason ?? null,
    selected_by: actorUserId,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toMonitoringPointFormUpdateRow(
  input: CreateEligibleFactoryInput,
): Record<string, unknown> {
  return {
    source_system: input.sourceSystem ?? 'monitoring_point_forms',
    source_factory_id: input.sourceFactoryId ?? null,
    monitoring_point_form_id: input.monitoringPointFormId ?? null,
    factory_registration_no_new: input.factoryRegistrationNoNew,
    factory_registration_no_old: input.factoryRegistrationNoOld ?? null,
    factory_name: input.factoryName,
    factory_type_sequence: input.factoryTypeSequence ?? null,
    ...(input.address !== undefined ? { address: input.address } : {}),
    province_name: input.provinceName,
    ...(input.industrialEstateName !== undefined
      ? { industrial_estate_name: input.industrialEstateName }
      : {}),
    latitude: input.coordinates?.latitude ?? null,
    longitude: input.coordinates?.longitude ?? null,
    business_activity: input.businessActivity ?? null,
    operation_status: input.operationStatus,
    machinery_horsepower: input.machineryHorsepower ?? null,
    production_capacity: input.productionCapacity ?? null,
    fuel_used: input.fuelUsed ?? null,
    ...(input.eia != null
      ? {
          eia_assessment: input.eia,
          eia_other: input.eia === 'อื่นๆ' ? (input.eiaOther ?? null) : null,
          has_eia: input.hasEia ?? null,
        }
      : input.hasEia != null
        ? { has_eia: input.hasEia }
        : {}),
    ...(input.projectName != null ? { project_name: input.projectName } : {}),
    selected_reason: input.selectedReason ?? null,
  };
}

function toDTO(row: EligibleFactoryRow): EligibleFactoryDTO {
  const latitude = toNullableNumber(row.latitude);
  const longitude = toNullableNumber(row.longitude);

  return {
    id: Number(row.id),
    sourceSystem: row.source_system,
    sourceFactoryId: row.source_factory_id,
    monitoringPointFormId: toNullableNumber(row.monitoring_point_form_id),
    factoryRegistrationNoNew: row.factory_registration_no_new,
    factoryRegistrationNoOld: row.factory_registration_no_old,
    factoryName: row.factory_name,
    factoryTypeSequence: row.factory_type_sequence,
    address: row.address,
    provinceName: row.province_name,
    industrialEstateName: row.industrial_estate_name,
    coordinates:
      latitude === null || longitude === null
        ? null
        : {
            latitude,
            longitude,
          },
    businessActivity: row.business_activity,
    operationStatus: row.operation_status,
    capitalAmount: toNullableNumber(row.capital_amount),
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    productionCapacity: row.production_capacity,
    wastewaterDischargeInfo: row.wastewater_discharge_info,
    boilerCount: toNullableNumber(row.boiler_count),
    boilerSizeEach: row.boiler_size_each,
    fuelUsed: row.fuel_used,
    eia: isStoredEiaAssessment(row.eia_assessment)
      ? row.eia_assessment
      : toNullableBoolean(row.has_eia) === null
        ? null
        : toNullableBoolean(row.has_eia)
          ? 'มี'
          : 'ไม่มี',
    eiaOther: row.eia_assessment === 'อื่นๆ' ? row.eia_other : null,
    hasEia: toNullableBoolean(row.has_eia),
    projectName: row.project_name,
    selectedReason: row.selected_reason,
    selectedBy: Number(row.selected_by),
    selectedAt: toIsoString(row.selected_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function isStoredEiaAssessment(
  value: string | null,
): value is NonNullable<EligibleFactoryDTO['eia']> {
  return ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ'].includes(value ?? '');
}

async function hydrateMeasurementPoints(rows: EligibleFactoryDTO[]): Promise<EligibleFactoryDTO[]> {
  const formIds = rows
    .map((row) => row.monitoringPointFormId)
    .filter((value): value is number => value !== null && value !== undefined);
  if (formIds.length === 0) return rows;

  const pointRows = await db<EligibleFactoryMonitoringPointRow>('factory_monitoring_points')
    .whereIn('form_id', Array.from(new Set(formIds)))
    .whereNull('deleted_at')
    .orderBy('form_id', 'asc')
    .orderBy('id', 'asc');
  const attachmentsByPointId = await loadMonitoringPointAttachmentDTOs(
    db,
    pointRows.map((point) => Number(point.id)),
  );

  const pointsByFormId = new Map<number, EligibleFactoryMeasurementPointDTO[]>();
  for (const pointRow of pointRows) {
    const formId = Number(pointRow.form_id);
    const currentPoints = pointsByFormId.get(formId) ?? [];
    pointsByFormId.set(formId, [
      ...currentPoints,
      toMeasurementPointDTO(pointRow, attachmentsByPointId.get(Number(pointRow.id)) ?? []),
    ]);
  }

  return rows.map((row) => ({
    ...row,
    measurementPoints:
      row.monitoringPointFormId === null
        ? []
        : (pointsByFormId.get(row.monitoringPointFormId) ?? []),
  }));
}

function toMeasurementPointDTO(
  row: EligibleFactoryMonitoringPointRow,
  attachments: EligibleFactoryMeasurementPointDTO['attachments'],
): EligibleFactoryMeasurementPointDTO {
  const details = parseObject(row.details_json);
  const timeSharingParameters = parseStoredStringList(details?.timeSharingParameters);

  return {
    id: Number(row.id),
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
    primaryFuel: row.primary_fuel,
    primaryFuelOther: row.primary_fuel_other,
    secondaryFuel: row.secondary_fuel,
    secondaryFuelOther: row.secondary_fuel_other,
    timeSharingParameters,
    sharedStackCode: timeSharingParameters.includes('ไม่มี')
      ? null
      : parseNullableString(details?.sharedStackCode),
    monitoringPointStatus: parseMonitoringPointStatus(details?.monitoringPointStatus),
    attachmentLinks: parseMonitoringPointAttachmentLinks(row.attachment_links_json),
    attachments,
    details: stripAttachmentFields(details),
  };
}

function parseStoredStringList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripAttachmentFields(
  details: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!details) return null;
  const sanitized = { ...details };
  delete sanitized.attachmentLinks;
  delete sanitized.attachments;
  return sanitized;
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function parseMonitoringPointStatus(value: unknown): MonitoringPointStatus | null {
  return MONITORING_POINT_STATUSES.find((status) => status === value) ?? null;
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
    // Fall back to the comma-separated format below.
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return Number(value);
}

function toNullableBoolean(value: boolean | number | null): boolean | null {
  if (value === null) return null;
  return Boolean(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
