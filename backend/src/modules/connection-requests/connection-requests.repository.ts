import type { Knex } from 'knex';
import { db } from '../../config/database';
import {
  CONNECTION_REQUEST_TYPE,
  CONNECTION_REQUEST_TYPE_LABELS,
  CONNECTION_REQUEST_STATUS_LABELS,
  type ContactPersonInput,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
  type ConnectionRequestType,
  type CreateConnectionRequestInput,
  type CurrentFactoryMeasurementPointDTO,
  type FactoryFavoriteDTO,
  type FactoryGeneralDTO,
  type FactorySummaryDTO,
  type MeasurementInstrumentsInput,
  type MeasurementPointDetailsInput,
  type ListConnectionRequestsQuery,
  type MeasurementPointDTO,
  type MeasurementPointInput,
  type RequestDocumentImageInput,
  type StatusHistoryDTO,
} from './connection-requests.types';

interface ConnectionRequestRow {
  id: number | string;
  request_no: string;
  request_type: ConnectionRequestType;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  industry_main_order: string | null;
  industry_sub_order: string | null;
  business_activity: string | null;
  has_eia: boolean | number | null;
  project_name: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  system_type: 'CEMS' | 'WPMS';
  status: ConnectionRequestStatus;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  contact_persons_json: string | null;
  notification_emails_json: string | null;
  officer_notification_emails_json: string | null;
  remarks: string | null;
  revision_reason: string | null;
  officer_note: string | null;
  connection_due_at: Date | string | null;
  confirmed_at: Date | string | null;
  verified_at: Date | string | null;
  created_by: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MeasurementPointRow {
  id: number | string;
  request_id: number | string;
  point_name: string;
  point_code: string | null;
  point_type: 'STACK' | 'WASTEWATER' | 'OTHER';
  latitude: number | string | null;
  longitude: number | string | null;
  parameters_json: string;
  description: string | null;
  details_json: string | null;
  documents_json: string | null;
  instruments_json: string | null;
}

interface ConnectedMeasurementPointRow {
  id: number | string;
  parameters_json: string;
}

interface CurrentFactoryMeasurementPointRow {
  factory_id: string;
  point_name: string;
  point_code: string | null;
  system_type: 'CEMS' | 'WPMS';
  parameters_json: string;
}

interface StatusHistoryRow {
  id: number | string;
  request_id: number | string;
  status: ConnectionRequestStatus;
  note: string | null;
  changed_by: number | string;
  changed_at: Date | string;
}

interface ListAccess {
  actorUserId: number;
  scope: string | null | undefined;
}

interface FactoryRow {
  id: number | string;
  fid: string;
  code: string;
  name: string;
  system_detail: string | null;
  province_name: string | null;
  is_active: boolean | number;
  factory_registration_no_old: string | null;
  factory_type_sequence: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  has_eia: boolean | number | null;
  eligible_factory_id: number | string | null;
}

interface FactoryGeneralRow {
  id: number | string;
  fid: string;
  code: string;
  name: string;
  system_id: number | string | null;
  system_detail: string | null;
  verify_status: number | string | null;
  authorize_start: Date | string | null;
  authorize_end: Date | string | null;
  province_name: string | null;
  industrial_estate_name: string | null;
  juristic_id: string | null;
  juristic_name: string | null;
  source_factory_id: string | null;
  factory_registration_no_old: string | null;
  factory_type_sequence: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  operation_status: string | null;
  capital_amount: number | string | null;
  machinery_horsepower: number | string | null;
  production_capacity: string | null;
  wastewater_discharge_info: string | null;
  boiler_count: number | string | null;
  boiler_size_each: string | null;
  fuel_used: string | null;
  has_eia: boolean | number | null;
}

interface FactoryAccess {
  actorUserId: number;
  scope: string | null | undefined;
}

interface StatusUpdate {
  revisionReason?: string | null;
  officerNote?: string | null;
  connectionDueAt?: string | null;
  confirmedAt?: string | null;
  verifiedAt?: string | null;
}

interface PointCodeSequenceRow {
  system_type: 'CEMS' | 'WPMS';
  prefix: 'S' | 'P';
  last_sequence: number | string;
}

interface FactoryFavoriteRow {
  id: number | string;
  factory_id: string;
  deleted_at: Date | string | null;
}

const TEMPORARY_FACTORY_TEXT = 'ไม่ระบุ';
const TEMPORARY_EIA_LABEL: 'ไม่มี' = 'ไม่มี';

export const connectionRequestsRepository = {
  async list(
    query: ListConnectionRequestsQuery,
    access: ListAccess,
  ): Promise<{ rows: ConnectionRequestDTO[]; total: number }> {
    const baseQuery = buildBaseQuery(query, access);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rows = await baseQuery.clone().orderBy('created_at', 'desc').orderBy('id', 'desc');
    const data = await hydrateMany(rows);
    return { rows: data, total };
  },

  async listFactoriesForAccess(access: FactoryAccess): Promise<FactorySummaryDTO[]> {
    const builder = buildFactoriesForAccessQuery(access);

    const rows = await builder;
    return rows.map(toFactorySummaryDTO);
  },

  async findFactoryGeneral(
    factoryId: string,
    access: FactoryAccess,
  ): Promise<FactoryGeneralDTO | null> {
    const builder = db<FactoryGeneralRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
      .leftJoin('juristics as j', 'j.id', 'f.juristic_id')
      .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
        this.on('ef.factory_registration_no_new', '=', 'f.code').andOnNull('ef.deleted_at');
      })
      .whereNull('f.deleted_at')
      .where((whereBuilder) => {
        whereBuilder
          .where('f.fid', factoryId)
          .orWhere('f.code', factoryId)
          .orWhere('ef.source_factory_id', factoryId)
          .orWhere('ef.factory_registration_no_new', factoryId);
      })
      .select(
        'f.id',
        'f.fid',
        'f.code',
        'f.name',
        'f.system_id',
        'f.system_detail',
        'f.verify_status',
        'f.authorize_start',
        'f.authorize_end',
        'p.name_th as province_name',
        'ie.name_th as industrial_estate_name',
        'j.juristic_id as juristic_id',
        'j.name_th as juristic_name',
        'ef.source_factory_id',
        'ef.factory_registration_no_old',
        'ef.factory_type_sequence',
        'ef.address',
        'ef.latitude',
        'ef.longitude',
        'ef.business_activity',
        'ef.operation_status',
        'ef.capital_amount',
        'ef.machinery_horsepower',
        'ef.production_capacity',
        'ef.wastewater_discharge_info',
        'ef.boiler_count',
        'ef.boiler_size_each',
        'ef.fuel_used',
        'ef.has_eia',
      );

    if (access.scope !== 'ALL') {
      builder
        .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
        .where('uj.user_id', access.actorUserId)
        .whereNull('uj.revoked_at');
    }

    const row = await builder.first();
    return row ? toFactoryGeneralDTO(row) : null;
  },

  async listFavoriteFactoryIds(actorUserId: number): Promise<string[]> {
    const rows = await db<FactoryFavoriteRow>('user_factory_favorites')
      .where('user_id', actorUserId)
      .whereNull('deleted_at')
      .select('factory_id')
      .orderBy('factory_id', 'asc');

    return rows.map((row) => row.factory_id);
  },

  async setFactoryFavorite(
    actorUserId: number,
    factoryId: string,
    isFavorite: boolean,
  ): Promise<FactoryFavoriteDTO> {
    const existing = await db<FactoryFavoriteRow>('user_factory_favorites')
      .where('user_id', actorUserId)
      .where('factory_id', factoryId)
      .first('id', 'factory_id', 'deleted_at');

    if (isFavorite) {
      if (existing) {
        await db('user_factory_favorites')
          .where('id', existing.id)
          .update({
            deleted_at: null,
            updated_by: actorUserId,
            updated_at: db.fn.now(),
          });
      } else {
        await db('user_factory_favorites').insert({
          user_id: actorUserId,
          factory_id: factoryId,
          created_by: actorUserId,
          updated_by: actorUserId,
        });
      }
    } else if (existing && existing.deleted_at === null) {
      await db('user_factory_favorites')
        .where('id', existing.id)
        .update({
          deleted_at: db.fn.now(),
          updated_by: actorUserId,
          updated_at: db.fn.now(),
        });
    }

    return { factoryId, isFavorite };
  },

  async findFactorySummariesForRequests(
    requests: ConnectionRequestDTO[],
  ): Promise<Map<string, FactorySummaryDTO>> {
    const factoryIds = [...new Set(requests.map((request) => request.factoryId))];
    const registrationNos = [...new Set(requests.map((request) => request.factoryRegistrationNo))];

    if (factoryIds.length === 0 && registrationNos.length === 0) return new Map();

    const rows = await db<FactoryRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .whereNull('f.deleted_at')
      .where((builder) => {
        if (factoryIds.length > 0) builder.whereIn('f.fid', factoryIds);
        if (registrationNos.length > 0) builder.orWhereIn('f.code', registrationNos);
      })
      .select(
        'f.id',
        'f.fid',
        'f.code',
        'f.name',
        'f.system_detail',
        'f.is_active',
        'p.name_th as province_name',
      );

    const map = new Map<string, FactorySummaryDTO>();
    rows.forEach((row) => {
      const dto = toFactorySummaryDTO(row);
      map.set(row.fid, dto);
      map.set(row.code, dto);
    });
    return map;
  },

  async listRequestsForFactories(factoryIds: string[]): Promise<ConnectionRequestDTO[]> {
    if (factoryIds.length === 0) return [];

    const rows = await db<ConnectionRequestRow>('cems_wpms_connection_requests')
      .whereNull('deleted_at')
      .whereIn('factory_id', factoryIds)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .select(
        'id',
        'request_no',
        'request_type',
        'factory_id',
        'factory_name',
        'factory_registration_no',
        'industry_main_order',
        'industry_sub_order',
        'business_activity',
        'has_eia',
        'project_name',
        'address',
        'latitude',
        'longitude',
        'system_type',
        'status',
        'contact_name',
        'contact_phone',
        'contact_email',
        'contact_persons_json',
        'notification_emails_json',
        'officer_notification_emails_json',
        'remarks',
        'revision_reason',
        'officer_note',
        'connection_due_at',
        'confirmed_at',
        'verified_at',
        'created_by',
        'created_at',
        'updated_at',
      );

    return hydrateMany(rows);
  },

  async listConnectedMeasurementPointsForFactories(
    factoryIds: string[],
  ): Promise<CurrentFactoryMeasurementPointDTO[]> {
    const lookupKeys = [...new Set(factoryIds.filter((factoryId) => factoryId.trim().length > 0))];
    if (lookupKeys.length === 0) return [];

    const rows = await db<CurrentFactoryMeasurementPointRow>('cems_wpms_connected_measurement_points')
      .whereNull('deleted_at')
      .whereIn('factory_id', lookupKeys)
      .select(
        'factory_id',
        'point_name',
        'point_code',
        'system_type',
        'parameters_json',
      )
      .orderBy('factory_id', 'asc')
      .orderBy('point_code', 'asc')
      .orderBy('point_name', 'asc');

    return rows.map((row) => ({
      factoryId: row.factory_id,
      stationId: row.point_code ?? row.point_name,
      pointName: row.point_name,
      pointCode: row.point_code,
      systemType: row.system_type,
      parameters: parseParameters(row.parameters_json),
      data: [],
    }));
  },

  async create(
    input: CreateConnectionRequestInput,
    actorUserId: number,
    initialStatus: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      const requestNo = await nextRequestNo(trx, input.systemType);
      const [{ id }] = await trx('cems_wpms_connection_requests')
        .insert({
          request_no: requestNo,
          request_type: input.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
          ...toRequestRow(input),
          status: initialStatus,
          created_by: actorUserId,
          updated_by: actorUserId,
        })
        .returning('id');

      const requestId = Number(id);
      await insertMeasurementPoints(trx, requestId, input.measurementPoints, actorUserId);
      await insertHistory(trx, requestId, initialStatus, actorUserId, 'ผู้ประกอบการส่งฟอร์ม');

      const created = await findByIdInTransaction(trx, requestId);
      if (!created) throw new Error('Created connection request could not be loaded');
      return created;
    });
  },

  async findById(id: number): Promise<ConnectionRequestDTO | null> {
    const row = await db<ConnectionRequestRow>('cems_wpms_connection_requests')
      .where('id', id)
      .whereNull('deleted_at')
      .first();
    return row ? hydrate(row) : null;
  },

  async replaceForm(
    id: number,
    input: CreateConnectionRequestInput,
    actorUserId: number,
    nextStatus: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      await trx('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          request_type: input.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
          ...toRequestRow(input),
          status: nextStatus,
          revision_reason: null,
          officer_note: null,
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await trx('cems_wpms_measurement_points')
        .where('request_id', id)
        .whereNull('deleted_at')
        .update({
          deleted_at: trx.fn.now(),
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await insertMeasurementPoints(trx, id, input.measurementPoints, actorUserId);
      await insertHistory(trx, id, nextStatus, actorUserId, 'ผู้ประกอบการแก้ไขและส่งฟอร์มอีกครั้ง');

      const updated = await findByIdInTransaction(trx, id);
      if (!updated) throw new Error('Updated connection request could not be loaded');
      return updated;
    });
  },

  async updateStatus(
    id: number,
    status: ConnectionRequestStatus,
    actorUserId: number,
    update: StatusUpdate,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      if (status === 'WAITING_CONNECTION') {
        await issuePointCodesForRequest(trx, id, actorUserId);
      }

      await trx('cems_wpms_connection_requests')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          status,
          revision_reason: update.revisionReason ?? null,
          officer_note: update.officerNote ?? null,
          ...(update.connectionDueAt !== undefined
            ? { connection_due_at: update.connectionDueAt }
            : {}),
          ...(update.confirmedAt !== undefined ? { confirmed_at: update.confirmedAt } : {}),
          ...(update.verifiedAt !== undefined ? { verified_at: update.verifiedAt } : {}),
          updated_by: actorUserId,
          updated_at: trx.fn.now(),
        });

      await insertHistory(
        trx,
        id,
        status,
        actorUserId,
        update.revisionReason ?? update.officerNote ?? null,
      );

      const updated = await findByIdInTransaction(trx, id);
      if (!updated) throw new Error('Updated connection request could not be loaded');
      return updated;
    });
  },

  async syncConnectedMeasurementPoints(
    request: ConnectionRequestDTO,
    actorUserId: number,
  ): Promise<void> {
    await db.transaction(async (trx) => {
      for (const point of request.measurementPoints) {
        const existing = await findConnectedPointForMeasurementPoint(trx, point);
        const parameters = uniqueParameters([
          ...(existing ? parseParameters(existing.parameters_json) : []),
          ...point.parameters,
        ]);

        await softDeleteConnectedPoint(trx, point, actorUserId);
        await trx('cems_wpms_connected_measurement_points').insert({
          source_request_id: request.id,
          source_measurement_point_id: point.id,
          factory_id: request.factoryId,
          factory_name: request.factoryName,
          factory_registration_no: request.factoryRegistrationNo,
          factory_address: request.address,
          factory_latitude: request.latitude,
          factory_longitude: request.longitude,
          system_type: request.systemType,
          point_name: point.pointName,
          point_code: point.pointCode,
          point_type: point.pointType,
          parameters_json: JSON.stringify(parameters),
          details_json: point.details ? JSON.stringify(point.details) : null,
          documents_json:
            point.documentsAndImages && point.documentsAndImages.length > 0
              ? JSON.stringify(point.documentsAndImages)
              : null,
          instruments_json: point.measurementInstruments
            ? JSON.stringify(point.measurementInstruments)
            : null,
          connected_at: request.verifiedAt,
          created_by: actorUserId,
          updated_by: actorUserId,
        });
      }
    });
  },
};

export function buildBaseQueryForTests(
  query: ListConnectionRequestsQuery,
  access: ListAccess,
): Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]> {
  return buildBaseQuery(query, access);
}

export function buildFactoriesForAccessQueryForTests(
  access: FactoryAccess,
): Knex.QueryBuilder<FactoryRow, FactoryRow[]> {
  return buildFactoriesForAccessQuery(access);
}

function buildFactoriesForAccessQuery(
  access: FactoryAccess,
): Knex.QueryBuilder<FactoryRow, FactoryRow[]> {
  const builder = db<FactoryRow>('factories as f')
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .join('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.factory_registration_no_new', '=', 'f.code')
        .orOn('ef.factory_registration_no_new', '=', 'f.fid')
        .orOn('ef.source_factory_id', '=', 'f.fid')
        .orOn('ef.source_factory_id', '=', 'f.code');
    })
    .whereNull('f.deleted_at')
    .whereNull('ef.deleted_at')
    .select(
      'f.id',
      'f.fid',
      'f.code',
      'f.name',
      'f.system_detail',
      'f.is_active',
      'p.name_th as province_name',
      'ef.factory_registration_no_old',
      'ef.factory_type_sequence',
      'ef.address',
      'ef.latitude',
      'ef.longitude',
      'ef.business_activity',
      'ef.has_eia',
      'ef.id as eligible_factory_id',
    )
    .orderBy('f.name', 'asc')
    .orderBy('f.id', 'asc');

  if (access.scope !== 'ALL') {
    builder
      .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
      .where('uj.user_id', access.actorUserId)
      .whereNull('uj.revoked_at');
  }

  return builder as unknown as Knex.QueryBuilder<FactoryRow, FactoryRow[]>;
}

function buildBaseQuery(
  query: ListConnectionRequestsQuery,
  access: ListAccess,
): Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]> {
  const builder = db<ConnectionRequestRow>('cems_wpms_connection_requests').whereNull('deleted_at');

  if (query.status) builder.where('status', query.status);
  if (query.requestType) builder.where('request_type', query.requestType);
  if (query.factoryId) builder.where('factory_id', query.factoryId);
  if (query.stationId) {
    const stationId = query.stationId;
    builder.whereExists(function stationFilter() {
      this.select(db.raw('1'))
        .from('cems_wpms_measurement_points as mp')
        .whereRaw('mp.request_id = cems_wpms_connection_requests.id')
        .whereNull('mp.deleted_at')
        .where((pointBuilder) => {
          pointBuilder
            .where('mp.point_code', stationId)
            .orWhere('mp.point_name', stationId)
            .orWhereExists(function connectedPointAliasFilter() {
              this.select(db.raw('1'))
                .from('cems_wpms_connected_measurement_points as cmp')
                .whereNull('cmp.deleted_at')
                .whereRaw('cmp.factory_id = cems_wpms_connection_requests.factory_id')
                .where((connectedPointBuilder) => {
                  connectedPointBuilder
                    .where('cmp.point_code', stationId)
                    .orWhere('cmp.point_name', stationId);
                })
                .where((aliasBuilder) => {
                  aliasBuilder
                    .whereRaw('mp.point_code = cmp.point_code')
                    .orWhereRaw('mp.point_name = cmp.point_name')
                    .orWhereRaw('mp.id = cmp.source_measurement_point_id');
                });
            });
        });
    });
  }
  if (access.scope !== 'ALL') builder.where('created_by', access.actorUserId);

  return builder.select(
    'id',
    'request_no',
    'request_type',
    'factory_id',
    'factory_name',
    'factory_registration_no',
    'industry_main_order',
    'industry_sub_order',
    'business_activity',
    'has_eia',
    'project_name',
    'address',
    'latitude',
    'longitude',
    'system_type',
    'status',
    'contact_name',
    'contact_phone',
    'contact_email',
    'contact_persons_json',
    'notification_emails_json',
    'officer_notification_emails_json',
    'remarks',
    'revision_reason',
    'officer_note',
    'connection_due_at',
    'confirmed_at',
    'verified_at',
    'created_by',
    'created_at',
    'updated_at',
  );
}

function toFactorySummaryDTO(row: FactoryRow): FactorySummaryDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(row.factory_type_sequence);
  const hasEia = toNullableBoolean(row.has_eia);
  const isEligible = row.eligible_factory_id !== null && row.eligible_factory_id !== undefined;
  return {
    id: Number(row.id),
    factoryId: row.fid,
    factoryName: row.name,
    newRegistrationNo: row.code,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.system_detail,
    industryMainOrder: factoryClass ?? TEMPORARY_FACTORY_TEXT,
    industrySubOrder: factorySubclass ?? TEMPORARY_FACTORY_TEXT,
    businessActivity: row.business_activity,
    eia: hasEia === null ? TEMPORARY_EIA_LABEL : hasEia ? 'มี' : 'ไม่มี',
    projectName: TEMPORARY_FACTORY_TEXT,
    address: row.address,
    latitude: nullableValueToString(row.latitude),
    longitude: nullableValueToString(row.longitude),
    province: row.province_name,
    isEligible,
    eligibilityStatus: isEligible ? 'เข้าข่าย' : 'ไม่เข้าข่าย',
    isActive: toNullableBoolean(row.is_active) ?? false,
  };
}

function toFactoryGeneralDTO(row: FactoryGeneralRow): FactoryGeneralDTO {
  const { factoryClass, factorySubclass } = splitFactoryTypeSequence(row.factory_type_sequence);
  return {
    id: Number(row.id),
    factoryId: row.fid,
    factoryName: row.name,
    newRegistrationNo: row.code,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.system_detail,
    industryMainOrder: factoryClass ?? TEMPORARY_FACTORY_TEXT,
    industrySubOrder: factorySubclass ?? TEMPORARY_FACTORY_TEXT,
    businessActivity: row.business_activity,
    eia:
      toNullableBoolean(row.has_eia) === null
        ? TEMPORARY_EIA_LABEL
        : toNullableBoolean(row.has_eia)
          ? 'มี'
          : 'ไม่มี',
    projectName: TEMPORARY_FACTORY_TEXT,
    address: row.address,
    latitude: nullableValueToString(row.latitude),
    longitude: nullableValueToString(row.longitude),
    province: row.province_name,
    juristicId: row.juristic_id,
    juristicName: row.juristic_name,
    industrialEstateName: row.industrial_estate_name,
    systemId: toNullableNumber(row.system_id),
    systemDetail: row.system_detail,
    verifyStatus: toNullableNumber(row.verify_status),
    authorizeStart: toNullableDateString(row.authorize_start),
    authorizeEnd: toNullableDateString(row.authorize_end),
    operationStatus: row.operation_status,
    capitalAmount: toNullableNumber(row.capital_amount),
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    productionCapacity: row.production_capacity,
    wastewaterDischargeInfo: row.wastewater_discharge_info,
    boilerCount: toNullableNumber(row.boiler_count),
    boilerSizeEach: row.boiler_size_each,
    fuelUsed: row.fuel_used,
    hasEia: toNullableBoolean(row.has_eia),
    formDefaults: {
      factoryId: row.fid,
      factoryName: row.name,
      factoryRegistrationNo: row.code,
    },
  };
}

function splitFactoryTypeSequence(value: string | null): {
  factoryClass: string | null;
  factorySubclass: string | null;
} {
  if (!value) return { factoryClass: null, factorySubclass: null };
  const [factoryClass, factorySubclass] = value.split(' / ', 2);
  return {
    factoryClass: factoryClass || null,
    factorySubclass: factorySubclass || null,
  };
}

async function findByIdInTransaction(
  trx: Knex.Transaction,
  id: number,
): Promise<ConnectionRequestDTO | null> {
  const row = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
    .where('id', id)
    .whereNull('deleted_at')
    .first();
  return row ? hydrate(row, trx) : null;
}

async function hydrate(
  row: ConnectionRequestRow,
  trx?: Knex.Transaction,
): Promise<ConnectionRequestDTO> {
  const executor = trx ?? db;
  const requestId = Number(row.id);
  const [pointRows, historyRows] = await Promise.all([
    executor<MeasurementPointRow>('cems_wpms_measurement_points')
      .where('request_id', requestId)
      .whereNull('deleted_at')
      .orderBy('id', 'asc'),
    executor<StatusHistoryRow>('cems_wpms_request_status_history')
      .where('request_id', requestId)
      .orderBy('changed_at', 'asc')
      .orderBy('id', 'asc'),
  ]);

  return toConnectionRequestDTO(row, pointRows, historyRows);
}

async function hydrateMany(rows: ConnectionRequestRow[]): Promise<ConnectionRequestDTO[]> {
  if (rows.length === 0) return [];

  const requestIds = rows.map((row) => Number(row.id));
  const [pointRows, historyRows] = await Promise.all([
    db<MeasurementPointRow>('cems_wpms_measurement_points')
      .whereIn('request_id', requestIds)
      .whereNull('deleted_at')
      .orderBy('request_id', 'asc')
      .orderBy('id', 'asc'),
    db<StatusHistoryRow>('cems_wpms_request_status_history')
      .whereIn('request_id', requestIds)
      .orderBy('request_id', 'asc')
      .orderBy('changed_at', 'asc')
      .orderBy('id', 'asc'),
  ]);

  const pointsByRequestId = groupRowsByRequestId(pointRows);
  const historyByRequestId = groupRowsByRequestId(historyRows);

  return rows.map((row) => {
    const requestId = Number(row.id);
    return toConnectionRequestDTO(
      row,
      pointsByRequestId.get(requestId) ?? [],
      historyByRequestId.get(requestId) ?? [],
    );
  });
}

function groupRowsByRequestId<T extends { request_id: number | string }>(
  rows: T[],
): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  rows.forEach((row) => {
    const requestId = Number(row.request_id);
    grouped.set(requestId, [...(grouped.get(requestId) ?? []), row]);
  });
  return grouped;
}

function toConnectionRequestDTO(
  row: ConnectionRequestRow,
  pointRows: MeasurementPointRow[],
  historyRows: StatusHistoryRow[],
): ConnectionRequestDTO {
  return {
    id: Number(row.id),
    requestNo: row.request_no,
    requestType: row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel:
      CONNECTION_REQUEST_TYPE_LABELS[row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION],
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    industryMainOrder: row.industry_main_order,
    industrySubOrder: row.industry_sub_order,
    businessActivity: row.business_activity,
    eia: toEiaLabel(row.has_eia),
    hasEia: toNullableBoolean(row.has_eia),
    projectName: row.project_name,
    address: row.address,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    systemType: row.system_type,
    status: row.status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[row.status],
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    contactPersons: toContactPersons(row),
    notificationEmails: toNotificationEmails(row),
    officerNotificationEmails: toOfficerNotificationEmails(row),
    remarks: row.remarks,
    revisionReason: row.revision_reason,
    officerNote: row.officer_note,
    connectionDueAt: toNullableIsoString(row.connection_due_at),
    confirmedAt: toNullableIsoString(row.confirmed_at),
    verifiedAt: toNullableIsoString(row.verified_at),
    measurementPoints: pointRows.map(toMeasurementPointDTO),
    statusHistory: historyRows.map(toStatusHistoryDTO),
    createdBy: Number(row.created_by),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toRequestRow(input: CreateConnectionRequestInput): Record<string, unknown> {
  const hasEia = input.hasEia ?? toBooleanFromEiaLabel(input.eia ?? null);
  return {
    factory_id: input.factoryId,
    factory_name: input.factoryName,
    factory_registration_no: input.factoryRegistrationNo,
    industry_main_order: input.industryMainOrder ?? null,
    industry_sub_order: input.industrySubOrder ?? null,
    business_activity: input.businessActivity ?? null,
    has_eia: hasEia,
    project_name: input.projectName ?? null,
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    system_type: input.systemType,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail ?? null,
    contact_persons_json:
      input.contactPersons && input.contactPersons.length > 0
        ? JSON.stringify(input.contactPersons)
        : null,
    notification_emails_json:
      input.notificationEmails && input.notificationEmails.length > 0
        ? JSON.stringify(input.notificationEmails)
        : null,
    officer_notification_emails_json:
      input.officerNotificationEmails && input.officerNotificationEmails.length > 0
        ? JSON.stringify(input.officerNotificationEmails)
        : null,
    remarks: input.remarks ?? null,
  };
}

async function insertMeasurementPoints(
  trx: Knex.Transaction,
  requestId: number,
  points: MeasurementPointInput[],
  actorUserId: number,
): Promise<void> {
  await trx('cems_wpms_measurement_points').insert(
    points.map((point) => ({
      request_id: requestId,
      point_name: point.pointName,
      point_code: point.pointCode ?? null,
      point_type: point.pointType,
      latitude: point.latitude ?? null,
      longitude: point.longitude ?? null,
      parameters_json: JSON.stringify(point.parameters ?? []),
      description: point.description ?? null,
      details_json: point.details ? JSON.stringify(point.details) : null,
      documents_json:
        point.documentsAndImages && point.documentsAndImages.length > 0
          ? JSON.stringify(point.documentsAndImages)
          : null,
      instruments_json: point.measurementInstruments
        ? JSON.stringify(point.measurementInstruments)
        : null,
      created_by: actorUserId,
      updated_by: actorUserId,
    })),
  );
}

async function findConnectedPointForMeasurementPoint(
  trx: Knex.Transaction,
  point: MeasurementPointDTO,
): Promise<ConnectedMeasurementPointRow | null> {
  const query = trx<ConnectedMeasurementPointRow>('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .select('id', 'parameters_json');

  if (point.pointCode) {
    query.where('point_code', point.pointCode);
  } else {
    query.where('source_measurement_point_id', point.id);
  }

  return (await query.first()) ?? null;
}

async function softDeleteConnectedPoint(
  trx: Knex.Transaction,
  point: MeasurementPointDTO,
  actorUserId: number,
): Promise<void> {
  const query = trx('cems_wpms_connected_measurement_points').whereNull('deleted_at');

  if (point.pointCode) {
    query.where('point_code', point.pointCode);
  } else {
    query.where('source_measurement_point_id', point.id);
  }

  await query.update({
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  });
}

function uniqueParameters(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

async function issuePointCodesForRequest(
  trx: Knex.Transaction,
  requestId: number,
  actorUserId: number,
): Promise<void> {
  const request = await trx<ConnectionRequestRow>('cems_wpms_connection_requests')
    .where('id', requestId)
    .whereNull('deleted_at')
    .first('system_type', 'request_type');
  if (!request) return;
  if (request.request_type === CONNECTION_REQUEST_TYPE.ADD_PARAMETER) return;

  const points = await trx<MeasurementPointRow>('cems_wpms_measurement_points')
    .where('request_id', requestId)
    .whereNull('deleted_at')
    .where((builder) => builder.whereNull('point_code').orWhere('point_code', ''))
    .orderBy('id', 'asc')
    .select('id');
  if (points.length === 0) return;

  const pointCodes = await reservePointCodes(trx, request.system_type, points.length);
  await Promise.all(
    points.map((point, index) =>
      trx('cems_wpms_measurement_points').where('id', point.id).whereNull('deleted_at').update({
        point_code: pointCodes[index],
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      }),
    ),
  );
}

async function reservePointCodes(
  trx: Knex.Transaction,
  systemType: 'CEMS' | 'WPMS',
  quantity: number,
): Promise<string[]> {
  const prefix = systemType === 'CEMS' ? 'S' : 'P';
  let sequence = await trx<PointCodeSequenceRow>('cems_wpms_point_code_sequences')
    .where('system_type', systemType)
    .forUpdate()
    .first();

  if (!sequence) {
    await trx('cems_wpms_point_code_sequences').insert({
      system_type: systemType,
      prefix,
      last_sequence: 0,
    });
    sequence = await trx<PointCodeSequenceRow>('cems_wpms_point_code_sequences')
      .where('system_type', systemType)
      .forUpdate()
      .first();
  }

  const currentSequence = Number(sequence?.last_sequence ?? 0);
  const existingMaxSequence = await findMaxExistingPointCodeSequence(trx, prefix);
  const firstSequence = Math.max(currentSequence, existingMaxSequence) + 1;
  const lastSequence = firstSequence + quantity - 1;

  await trx('cems_wpms_point_code_sequences').where('system_type', systemType).update({
    last_sequence: lastSequence,
    updated_at: trx.fn.now(),
  });

  return Array.from(
    { length: quantity },
    (_, index) => `${prefix}${String(firstSequence + index).padStart(4, '0')}`,
  );
}

async function findMaxExistingPointCodeSequence(
  trx: Knex.Transaction,
  prefix: 'S' | 'P',
): Promise<number> {
  const rows = await trx<MeasurementPointRow>('cems_wpms_measurement_points')
    .whereNull('deleted_at')
    .where('point_code', 'like', `${prefix}%`)
    .select('point_code');

  return rows.reduce((maxSequence, row) => {
    const match = row.point_code?.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) return maxSequence;
    return Math.max(maxSequence, Number(match[1]));
  }, 0);
}

async function insertHistory(
  trx: Knex.Transaction,
  requestId: number,
  status: ConnectionRequestStatus,
  actorUserId: number,
  note: string | null,
): Promise<void> {
  await trx('cems_wpms_request_status_history').insert({
    request_id: requestId,
    status,
    note,
    changed_by: actorUserId,
  });
}

async function nextRequestNo(trx: Knex.Transaction, systemType: 'CEMS' | 'WPMS'): Promise<string> {
  const prefix = buildRequestNoPrefix(systemType);
  const totalRow = await trx('cems_wpms_connection_requests')
    .where('request_no', 'like', `${prefix}-%`)
    .count<{ total: number | string }>('id as total')
    .first();
  const sequence = Number(totalRow?.total ?? 0) + 1;
  return `${prefix}-${String(sequence).padStart(5, '0')}`;
}

export function buildRequestNoPrefix(systemType: 'CEMS' | 'WPMS', date = new Date()): string {
  const gregorianYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
    }).format(date),
  );
  const buddhistYear = String((gregorianYear + 543) % 100).padStart(2, '0');
  return `${systemType}-${buddhistYear}`;
}

function toMeasurementPointDTO(row: MeasurementPointRow): MeasurementPointDTO {
  return {
    id: Number(row.id),
    pointName: row.point_name,
    pointCode: row.point_code,
    pointType: row.point_type,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    parameters: parseParameters(row.parameters_json),
    description: row.description,
    details: parseJsonObject(row.details_json),
    documentsAndImages: parseJsonArray<RequestDocumentImageInput>(row.documents_json),
    measurementInstruments: parseJsonObject<MeasurementInstrumentsInput>(row.instruments_json),
  };
}

function toStatusHistoryDTO(row: StatusHistoryRow): StatusHistoryDTO {
  return {
    id: Number(row.id),
    status: row.status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[row.status],
    note: row.note,
    changedBy: Number(row.changed_by),
    changedAt: toIsoString(row.changed_at),
  };
}

function toContactPersons(row: ConnectionRequestRow): ContactPersonInput[] {
  const contacts = parseJsonArray<ContactPersonInput>(row.contact_persons_json).filter(
    (contact) => contact.name && contact.phone,
  );
  if (contacts.length > 0) return contacts;
  return [
    {
      name: row.contact_name,
      phone: row.contact_phone,
      email: row.contact_email,
      position: null,
    },
  ];
}

function toNotificationEmails(row: ConnectionRequestRow): string[] {
  const emails = parseJsonArray<string>(row.notification_emails_json).filter(
    (email) => typeof email === 'string' && email.length > 0,
  );
  if (emails.length > 0) return emails;
  return row.contact_email ? [row.contact_email] : [];
}

function toOfficerNotificationEmails(row: ConnectionRequestRow): string[] {
  return parseJsonArray<string>(row.officer_notification_emails_json).filter(
    (email) => typeof email === 'string' && email.length > 0,
  );
}

function toEiaLabel(value: boolean | number | null): 'มี' | 'ไม่มี' | null {
  const hasEia = toNullableBoolean(value);
  if (hasEia === null) return null;
  return hasEia ? 'มี' : 'ไม่มี';
}

function toBooleanFromEiaLabel(value: 'มี' | 'ไม่มี' | null): boolean | null {
  if (value === 'มี') return true;
  if (value === 'ไม่มี') return false;
  return null;
}

function parseParameters(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends object = MeasurementPointDetailsInput>(
  value: string | null,
): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    return null;
  }
  return null;
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
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

function nullableValueToString(value: number | string | null): string | null {
  if (value === null) return null;
  return String(value);
}

function toNullableDateString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  return toIsoString(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
