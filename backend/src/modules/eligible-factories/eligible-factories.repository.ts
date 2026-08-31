import type { Knex } from 'knex';
import { db } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
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
  EligibleFactoryAddRequestDTO,
  EligibleFactoryAddRequestRecordDTO,
  EligibleFactoryMeasurementPointDTO,
  ListEligibleFactoryAddRequestsQuery,
  ListEligibleFactoriesQuery,
  ReviewEligibleFactoryAddRequestInput,
} from './eligible-factories.types';
import { ELIGIBLE_FACTORY_ADD_REQUEST_STATUS_LABELS } from './eligible-factories.types';
import { assertEligibleFactoryAddRequestReviewable } from './eligible-factory-add-request-state';
import { isMssqlUniqueConstraintError } from './eligible-factory-add-request-errors';
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

interface EligibleFactoryAddRequestRow {
  id: number | string;
  factory_master_id: number | string;
  source_factory_id: string | null;
  factory_registration_no: string;
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
  reason: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  is_open: boolean | number;
  factory_snapshot_json: string;
  submitted_by: number | string;
  reviewed_by: number | string | null;
  submitted_at: Date | string;
  reviewed_at: Date | string | null;
  officer_note: string | null;
  eligible_factory_id: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
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

  async findByRegistrationNoNew(
    registrationNoNew: string,
    trx?: Knex.Transaction,
  ): Promise<{
    id: number;
    factoryRegistrationNoNew: string;
    monitoringPointFormId: number | null;
  } | null> {
    const query = (trx ?? db)('eligible_factories')
      .where('factory_registration_no_new', registrationNoNew)
      .whereNull('deleted_at')
      .select('id', 'factory_registration_no_new', 'monitoring_point_form_id')
      .first();
    if (trx) query.forUpdate();
    const row = await query;

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
    trx?: Knex.Transaction,
    options?: { reviewingAddRequestId?: number },
  ): Promise<EligibleFactoryDTO> {
    if (trx) return createEligibleFactoryRecord(trx, input, actorUserId, options);
    return db.transaction((transaction) =>
      createEligibleFactoryRecord(transaction, input, actorUserId, options),
    );
  },

  async listAddRequests(
    query: ListEligibleFactoryAddRequestsQuery,
    access?: EligibleFactoryAccessContext,
  ): Promise<{ rows: EligibleFactoryAddRequestDTO[]; total: number }> {
    const filters = await resolveSelectedFactoryAccessFilters(access);
    const baseQuery = buildEligibleFactoryAddRequestsBaseQuery(
      [filters],
      access?.actorUserId,
    ).where('ef.status', query.status);
    applyEligibleFactoryAddRequestSearch(baseQuery, query.search);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('ef.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);
    const rows = await baseQuery
      .clone()
      .orderBy('ef.submitted_at', 'desc')
      .orderBy('ef.id', 'desc')
      .offset((query.page - 1) * query.perPage)
      .limit(query.perPage);
    return { rows: rows.map(toAddRequestDTO), total };
  },

  async findAddRequestById(
    id: number,
    trx?: Knex.Transaction,
  ): Promise<EligibleFactoryAddRequestRecordDTO | null> {
    const row = await (trx ?? db)<EligibleFactoryAddRequestRow>(
      'eligible_factory_add_requests as ef',
    )
      .where('ef.id', id)
      .whereNull('ef.deleted_at')
      .first();
    return row ? toAddRequestRecordDTO(row) : null;
  },

  async findOpenAddRequestByFactoryMasterId(
    factoryMasterId: number,
    trx?: Knex.Transaction,
  ): Promise<{ id: number; factoryMasterId: number } | null> {
    const query = (trx ?? db)('eligible_factory_add_requests')
      .where('factory_master_id', factoryMasterId)
      .where('is_open', true)
      .whereNull('deleted_at')
      .first('id', 'factory_master_id');
    if (trx) query.forUpdate();
    const row = await query;
    if (!row) return null;
    return {
      id: Number(row.id),
      factoryMasterId: Number(row.factory_master_id),
    };
  },

  async createAddRequest(
    input: {
      factoryMasterId: number;
      factoryId: string;
      factoryName: string;
      factoryRegistrationNo: string;
      provinceName: string;
      reason: string;
      requestedFactory: CreateEligibleFactoryInput;
    },
    actorUserId: number,
  ): Promise<EligibleFactoryAddRequestDTO> {
    return db.transaction(async (trx) => {
      const factoryMaster = await trx('factories')
        .where('id', input.factoryMasterId)
        .whereNull('deleted_at')
        .forUpdate()
        .first('id');
      if (!factoryMaster) throw new NotFoundError('Factory not found for this user');

      const selected = await this.findByRegistrationNoNew(input.factoryRegistrationNo, trx);
      if (selected) {
        throw new ConflictError('Factory is already selected as eligible', {
          factoryRegistrationNoNew: input.factoryRegistrationNo,
        });
      }
      const openRequest = await this.findOpenAddRequestByFactoryMasterId(
        input.factoryMasterId,
        trx,
      );
      if (openRequest) {
        throw new ConflictError('Factory already has a pending add-factory request', {
          requestId: openRequest.id,
        });
      }

      const [created] = await trx('eligible_factory_add_requests')
        .insert({
          factory_master_id: input.factoryMasterId,
          source_factory_id: input.requestedFactory.sourceFactoryId ?? input.factoryId,
          factory_registration_no: input.factoryRegistrationNo,
          factory_registration_no_old: input.requestedFactory.factoryRegistrationNoOld ?? null,
          factory_name: input.factoryName,
          factory_type_sequence: input.requestedFactory.factoryTypeSequence ?? null,
          address: input.requestedFactory.address ?? null,
          province_name: input.provinceName,
          industrial_estate_name: input.requestedFactory.industrialEstateName ?? null,
          latitude: input.requestedFactory.coordinates?.latitude ?? null,
          longitude: input.requestedFactory.coordinates?.longitude ?? null,
          business_activity: input.requestedFactory.businessActivity ?? null,
          operation_status: input.requestedFactory.operationStatus,
          capital_amount: input.requestedFactory.capitalAmount ?? null,
          machinery_horsepower: input.requestedFactory.machineryHorsepower ?? null,
          production_capacity: input.requestedFactory.productionCapacity ?? null,
          wastewater_discharge_info: input.requestedFactory.wastewaterDischargeInfo ?? null,
          boiler_count: input.requestedFactory.boilerCount ?? null,
          boiler_size_each: input.requestedFactory.boilerSizeEach ?? null,
          fuel_used: input.requestedFactory.fuelUsed ?? null,
          eia_assessment: input.requestedFactory.eia ?? null,
          eia_other:
            input.requestedFactory.eia === 'อื่นๆ'
              ? (input.requestedFactory.eiaOther ?? null)
              : null,
          has_eia: input.requestedFactory.hasEia ?? null,
          project_name: input.requestedFactory.projectName ?? null,
          reason: input.reason,
          status: 'PENDING_REVIEW',
          is_open: true,
          factory_snapshot_json: JSON.stringify(input.requestedFactory),
          submitted_by: actorUserId,
          reviewed_by: null,
          reviewed_at: null,
          officer_note: null,
          eligible_factory_id: null,
          created_by: actorUserId,
          updated_by: actorUserId,
        })
        .returning('id');
      const request = await this.findAddRequestById(Number(created.id), trx);
      if (!request) throw new Error('Created eligible factory request could not be loaded');
      return request;
    });
  },

  async reviewAddRequest(
    requestId: number,
    input: ReviewEligibleFactoryAddRequestInput,
    actorUserId: number,
    accesses: EligibleFactoryAccessContext[],
  ): Promise<EligibleFactoryAddRequestDTO | null> {
    const filters = await Promise.all(accesses.map(resolveSelectedFactoryAccessFilters));
    try {
      return await db.transaction(async (trx) => {
        const visible = await buildEligibleFactoryAddRequestsBaseQuery(filters, actorUserId, trx)
          .clearSelect()
          .where('ef.id', requestId)
          .first('ef.id', 'ef.factory_master_id');
        if (!visible) return null;

        if (input.decision === 'APPROVE') {
          const factoryMaster = await trx('factories')
            .where('id', Number(visible.factory_master_id))
            .whereNull('deleted_at')
            .forUpdate()
            .first('id');
          if (!factoryMaster) {
            throw new ConflictError(
              'Factory is no longer active and cannot be selected as eligible',
            );
          }
        }

        const lockedRow = await trx<EligibleFactoryAddRequestRow>('eligible_factory_add_requests')
          .where('id', requestId)
          .whereNull('deleted_at')
          .forUpdate()
          .first();
        if (!lockedRow) return null;
        const request = toAddRequestRecordDTO(lockedRow);

        assertEligibleFactoryAddRequestReviewable(request, Boolean(lockedRow.is_open), actorUserId);

        let eligibleFactoryId: number | null = null;
        if (input.decision === 'APPROVE') {
          const selected = await this.findByRegistrationNoNew(
            request.requestedFactory.factoryRegistrationNoNew,
            trx,
          );
          if (selected) {
            eligibleFactoryId = selected.id;
          } else {
            const eligibleFactory = await this.create(
              { ...request.requestedFactory, selectedReason: request.reason },
              actorUserId,
              trx,
              { reviewingAddRequestId: requestId },
            );
            eligibleFactoryId = eligibleFactory.id;
          }
        }

        const nextStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const affected = await trx('eligible_factory_add_requests')
          .where('id', requestId)
          .where('status', 'PENDING_REVIEW')
          .where('is_open', true)
          .whereNull('deleted_at')
          .update({
            status: nextStatus,
            is_open: false,
            eligible_factory_id: eligibleFactoryId,
            reviewed_by: actorUserId,
            reviewed_at: trx.fn.now(),
            officer_note: input.officerNote ?? null,
            updated_by: actorUserId,
            updated_at: trx.fn.now(),
          });
        if (affected !== 1) {
          throw new ConflictError(
            'Eligible factory add request changed while it was being reviewed',
          );
        }

        const updated = await this.findAddRequestById(requestId, trx);
        if (!updated) throw new Error('Reviewed eligible factory add request could not be loaded');
        return updated;
      });
    } catch (error) {
      if (isMssqlUniqueConstraintError(error)) {
        throw new ConflictError(
          'Factory eligibility changed while the add request was being reviewed; retry the review',
        );
      }
      throw error;
    }
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

function buildEligibleFactoryAddRequestsBaseQuery(
  filterSets: Array<Awaited<ReturnType<typeof resolveSelectedFactoryAccessFilters>>>,
  actorUserId: number | undefined,
  trx?: Knex.Transaction,
): Knex.QueryBuilder<EligibleFactoryAddRequestRow, EligibleFactoryAddRequestRow[]> {
  const builder = (trx ?? db)<EligibleFactoryAddRequestRow>('eligible_factory_add_requests as ef')
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin('industrial_estates as ie', 'ie.name_th', 'ef.industrial_estate_name')
    .whereNull('ef.deleted_at');

  for (const filters of filterSets) {
    applySelectedFactoryAccessFilters(
      builder as unknown as Knex.QueryBuilder,
      filters,
      actorUserId,
      {
        registrationNo: 'ef.factory_registration_no',
        sourceFactoryId: 'ef.source_factory_id',
        factoryMasterId: 'ef.factory_master_id',
        provinceName: 'ef.province_name',
        industrialEstateName: 'ef.industrial_estate_name',
        factoryTypeSequence: 'ef.factory_type_sequence',
      },
    );
  }

  return builder.select(
    'ef.id as id',
    'ef.factory_master_id as factory_master_id',
    'ef.source_factory_id as source_factory_id',
    'ef.factory_registration_no as factory_registration_no',
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
    'ef.reason as reason',
    'ef.status as status',
    'ef.is_open as is_open',
    'ef.factory_snapshot_json as factory_snapshot_json',
    'ef.submitted_by as submitted_by',
    'ef.reviewed_by as reviewed_by',
    'ef.submitted_at as submitted_at',
    'ef.reviewed_at as reviewed_at',
    'ef.officer_note as officer_note',
    'ef.eligible_factory_id as eligible_factory_id',
    'ef.created_at as created_at',
    'ef.updated_at as updated_at',
  );
}

function applyEligibleFactoryAddRequestSearch(
  builder: Knex.QueryBuilder,
  search: string | undefined,
): void {
  if (!search) return;
  const pattern = `%${escapeLikePattern(search)}%`;
  builder.where(function eligibleFactoryAddRequestSearch() {
    this.whereRaw("ef.factory_name LIKE ? ESCAPE '~'", [pattern])
      .orWhereRaw("ef.factory_registration_no LIKE ? ESCAPE '~'", [pattern])
      .orWhereRaw("ef.source_factory_id LIKE ? ESCAPE '~'", [pattern])
      .orWhereRaw("ef.province_name LIKE ? ESCAPE '~'", [pattern])
      .orWhereRaw("ef.reason LIKE ? ESCAPE '~'", [pattern]);
  });
}

function escapeLikePattern(value: string): string {
  return value.replace(/[~%_\[]/gu, (character) => `~${character}`);
}

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
  const connectedPoint = await buildConnectedPointLookupQuery(trx, id, monitoringPointFormId);
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

function buildConnectedPointLookupQuery(
  querySource: Knex,
  eligibleFactoryId: number,
  monitoringPointFormId: number | null,
) {
  const query = querySource('cems_wpms_connected_measurement_points');

  if (monitoringPointFormId === null) {
    query.where('cems_wpms_connected_measurement_points.eligible_factory_id', eligibleFactoryId);
  } else {
    const linkedEligibleFactoryIds = querySource('eligible_factories')
      .select('id')
      .where('monitoring_point_form_id', monitoringPointFormId);
    query.whereIn(
      'cems_wpms_connected_measurement_points.eligible_factory_id',
      linkedEligibleFactoryIds,
    );
  }

  return query
    .whereNull('cems_wpms_connected_measurement_points.deleted_at')
    .forUpdate()
    .first('cems_wpms_connected_measurement_points.id');
}

export function buildConnectedPointLookupQueryForTests(
  querySource: Knex,
  eligibleFactoryId: number,
  monitoringPointFormId: number | null,
) {
  return buildConnectedPointLookupQuery(querySource, eligibleFactoryId, monitoringPointFormId);
}

async function createEligibleFactoryRecord(
  trx: Knex.Transaction,
  input: CreateEligibleFactoryInput,
  actorUserId: number,
  options?: { reviewingAddRequestId?: number },
): Promise<EligibleFactoryDTO> {
  const factoryMaster = await lockFactoryMasterForEligibleInput(trx, input);
  if (factoryMaster) {
    const openRequest = await eligibleFactoriesRepository.findOpenAddRequestByFactoryMasterId(
      factoryMaster.id,
      trx,
    );
    if (openRequest && openRequest.id !== options?.reviewingAddRequestId) {
      throw new ConflictError(
        'Factory has a pending add-factory request; review that request before selecting it directly',
        { requestId: openRequest.id },
      );
    }
  }

  const selected = await eligibleFactoriesRepository.findByRegistrationNoNew(
    input.factoryRegistrationNoNew,
    trx,
  );
  if (selected) {
    throw new ConflictError('Factory is already selected as eligible', {
      factoryRegistrationNoNew: input.factoryRegistrationNoNew,
    });
  }

  const restored = await restoreDeletedFactory(input, actorUserId, trx);
  if (restored) return restored;

  const [{ id }] = await trx('eligible_factories')
    .insert(toInsertRow(input, actorUserId))
    .returning('id');
  const created = await eligibleFactoriesRepository.findById(Number(id), trx);
  if (!created) throw new Error('Created eligible factory could not be loaded');
  return created;
}

async function lockFactoryMasterForEligibleInput(
  trx: Knex.Transaction,
  input: CreateEligibleFactoryInput,
): Promise<{ id: number } | null> {
  const identifiers = [input.sourceFactoryId, input.factoryRegistrationNoNew]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (identifiers.length === 0) return null;

  const row = await trx('factories')
    .whereNull('deleted_at')
    .where((builder) => {
      builder.whereIn('fid', identifiers).orWhereIn('code', identifiers);
    })
    .orderBy('id', 'asc')
    .forUpdate()
    .first('id');
  return row ? { id: Number(row.id) } : null;
}

async function restoreDeletedFactory(
  input: CreateEligibleFactoryInput,
  actorUserId: number,
  trx?: Knex.Transaction,
): Promise<EligibleFactoryDTO | null> {
  const querySource = trx ?? db;
  const deletedFactoryQuery = querySource('eligible_factories')
    .where('factory_registration_no_new', input.factoryRegistrationNoNew)
    .whereNotNull('deleted_at')
    .select<{ id: number | string }[]>('id')
    .first();
  if (trx) deletedFactoryQuery.forUpdate();
  const existingDeleted = await deletedFactoryQuery;

  if (!existingDeleted) return null;

  await querySource('eligible_factories')
    .where('id', existingDeleted.id)
    .update({
      ...toInsertRow(input, actorUserId),
      deleted_at: null,
      selected_at: querySource.fn.now(),
      updated_at: querySource.fn.now(),
    });

  return eligibleFactoriesRepository.findById(Number(existingDeleted.id), trx);
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

function toAddRequestDTO(row: EligibleFactoryAddRequestRow): EligibleFactoryAddRequestDTO {
  return {
    id: Number(row.id),
    factoryId: row.source_factory_id ?? row.factory_registration_no,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    provinceName: row.province_name,
    reason: row.reason,
    status: row.status,
    statusLabel: ELIGIBLE_FACTORY_ADD_REQUEST_STATUS_LABELS[row.status],
    submittedBy: Number(row.submitted_by),
    submittedAt: toIsoString(row.submitted_at),
    reviewedBy: toNullableNumber(row.reviewed_by),
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at) : null,
    reviewNote: row.officer_note,
    eligibleFactoryId: toNullableNumber(row.eligible_factory_id),
  };
}

function toAddRequestRecordDTO(
  row: EligibleFactoryAddRequestRow,
): EligibleFactoryAddRequestRecordDTO {
  const requestedFactory = parseObject(row.factory_snapshot_json);
  if (!requestedFactory) {
    throw new Error('Eligible factory request snapshot is invalid');
  }

  return {
    ...toAddRequestDTO(row),
    factoryMasterId: Number(row.factory_master_id),
    requestedFactory: {
      sourceSystem:
        typeof requestedFactory.sourceSystem === 'string'
          ? requestedFactory.sourceSystem
          : 'eligible_factory_add_requests',
      sourceFactoryId:
        typeof requestedFactory.sourceFactoryId === 'string'
          ? requestedFactory.sourceFactoryId
          : row.source_factory_id,
      monitoringPointFormId:
        typeof requestedFactory.monitoringPointFormId === 'number'
          ? requestedFactory.monitoringPointFormId
          : null,
      factoryName: row.factory_name,
      factoryRegistrationNoNew: row.factory_registration_no,
      factoryRegistrationNoOld: row.factory_registration_no_old,
      factoryTypeSequence:
        typeof requestedFactory.factoryTypeSequence === 'string'
          ? requestedFactory.factoryTypeSequence
          : null,
      address: row.address,
      provinceName: row.province_name,
      industrialEstateName: row.industrial_estate_name,
      coordinates:
        toNullableNumber(row.latitude) === null || toNullableNumber(row.longitude) === null
          ? null
          : {
              latitude: Number(row.latitude),
              longitude: Number(row.longitude),
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
      eia: isStoredEiaAssessment(row.eia_assessment) ? row.eia_assessment : null,
      eiaOther: row.eia_assessment === 'อื่นๆ' ? row.eia_other : null,
      hasEia: toNullableBoolean(row.has_eia),
      projectName: row.project_name,
      selectedReason: row.reason,
    },
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
