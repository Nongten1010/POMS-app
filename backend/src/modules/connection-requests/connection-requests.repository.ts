import type { Knex } from 'knex';
import { db } from '../../config/database';
import {
  CONNECTION_REQUEST_TYPE,
  CONNECTION_REQUEST_TYPE_LABELS,
  CONNECTION_REQUEST_STATUS_LABELS,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
  type ConnectionRequestType,
  type CreateConnectionRequestInput,
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
  system_type: 'CEMS' | 'WPMS';
  status: ConnectionRequestStatus;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
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

interface StatusHistoryRow {
  id: number | string;
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
    const data = await Promise.all(rows.map((row) => hydrate(row)));
    return { rows: data, total };
  },

  async listFactoriesForAccess(access: FactoryAccess): Promise<FactorySummaryDTO[]> {
    const builder = db<FactoryRow>('factories as f')
      .leftJoin('provinces as p', 'p.id', 'f.province_id')
      .whereNull('f.deleted_at')
      .select(
        'f.id',
        'f.fid',
        'f.code',
        'f.name',
        'f.system_detail',
        'f.is_active',
        'p.name_th as province_name',
      )
      .orderBy('f.name', 'asc')
      .orderBy('f.id', 'asc');

    if (access.scope !== 'ALL') {
      builder
        .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
        .where('uj.user_id', access.actorUserId)
        .whereNull('uj.revoked_at');
    }

    const rows = await builder;
    return rows.map(toFactorySummaryDTO);
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
        'system_type',
        'status',
        'contact_name',
        'contact_phone',
        'contact_email',
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

    return Promise.all(rows.map((row) => hydrate(row)));
  },

  async create(
    input: CreateConnectionRequestInput,
    actorUserId: number,
    initialStatus: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDTO> {
    return db.transaction(async (trx) => {
      const requestNo = await nextRequestNo(trx);
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
};

function buildBaseQuery(
  query: ListConnectionRequestsQuery,
  access: ListAccess,
): Knex.QueryBuilder<ConnectionRequestRow, ConnectionRequestRow[]> {
  const builder = db<ConnectionRequestRow>('cems_wpms_connection_requests').whereNull('deleted_at');

  if (query.status) builder.where('status', query.status);
  if (query.requestType) builder.where('request_type', query.requestType);
  if (query.factoryId) builder.where('factory_id', query.factoryId);
  if (access.scope !== 'ALL') builder.where('created_by', access.actorUserId);

  return builder.select(
    'id',
    'request_no',
    'request_type',
    'factory_id',
    'factory_name',
    'factory_registration_no',
    'system_type',
    'status',
    'contact_name',
    'contact_phone',
    'contact_email',
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
  return {
    id: Number(row.id),
    factoryId: row.fid,
    factoryName: row.name,
    newRegistrationNo: row.code,
    oldRegistrationNo: null,
    industryType: row.system_detail,
    industryMainOrder: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    projectName: null,
    address: null,
    latitude: null,
    longitude: null,
    province: row.province_name,
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

  return {
    id: requestId,
    requestNo: row.request_no,
    requestType: row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel:
      CONNECTION_REQUEST_TYPE_LABELS[row.request_type ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION],
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    systemType: row.system_type,
    status: row.status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[row.status],
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
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
  return {
    factory_id: input.factoryId,
    factory_name: input.factoryName,
    factory_registration_no: input.factoryRegistrationNo,
    system_type: input.systemType,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail ?? null,
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
      parameters_json: JSON.stringify(point.parameters),
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

async function nextRequestNo(trx: Knex.Transaction): Promise<string> {
  const now = new Date();
  const prefix = `CR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const totalRow = await trx('cems_wpms_connection_requests')
    .where('request_no', 'like', `${prefix}-%`)
    .count<{ total: number | string }>('id as total')
    .first();
  const sequence = Number(totalRow?.total ?? 0) + 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
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

function toNullableIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  return toIsoString(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
