import type { Knex } from 'knex';
import { db } from '../../config/database';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { splitFactoryTypeSequence } from '../eligible-factories/factory-type-sequence';
import type {
  KwpFormFactoryTableRowDTO,
  KwpFormReportAccess,
  KwpFormRequestTableRowDTO,
  KwpFormStatus,
  KwpFormStatusHistoryDTO,
  KwpFormType,
  ListKwpFormRequestsQuery,
} from './kwp-form-reports.types';

interface FactoryTableRow {
  factory_id: string;
  factory_fid: string;
  factory_code: string;
  factory_name: string;
  factory_system_detail: string | null;
  province_name: string | null;
  province_region: string | null;
  old_registration_no: string | null;
  eligible_address: string | null;
  eligible_business_activity: string | null;
  eligible_factory_type_sequence: string | null;
  connected_point_count: number | string | null;
}

interface SubmissionRow {
  id: number | string;
  submission_no: string;
  form_type: KwpFormType;
  status: KwpFormStatus;
  factory_id: string | null;
  factory_name: string;
  factory_registration_no: string | null;
  factory_address: string | null;
  industry_type: string | null;
  connected_point_id: number | string | null;
  point_code: string | null;
  point_name: string | null;
  point_type: string | null;
  submitted_at: Date | string | null;
  reviewed_at: Date | string | null;
  officer_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  province_name: string | null;
  province_region: string | null;
  system_type: string | null;
}

interface StatusHistoryRow {
  id: number | string;
  submission_id: number | string;
  status: KwpFormStatus;
  note: string | null;
  changed_by: number | string | null;
  changed_by_username: string | null;
  changed_by_prename_th: string | null;
  changed_by_first_name: string | null;
  changed_by_last_name: string | null;
  changed_at: Date | string;
}

export const kwpFormReportsRepository = {
  async listFactories(
    access: KwpFormReportAccess,
  ): Promise<{ rows: KwpFormFactoryTableRowDTO[]; total: number }> {
    const rows = await buildFactoryQuery(access);
    const data = rows.map(toFactoryDTO);
    return { rows: data, total: data.length };
  },

  async listRequests(
    query: ListKwpFormRequestsQuery,
    access: KwpFormReportAccess,
  ): Promise<{ rows: KwpFormRequestTableRowDTO[]; total: number }> {
    const baseQuery = buildRequestQuery(query, access);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('s.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rows = await baseQuery.clone().orderBy('s.created_at', 'desc').orderBy('s.id', 'desc');
    const historyBySubmissionId = await listStatusHistoryForSubmissions(rows.map((row) => row.id));

    return {
      rows: rows.map((row) => toRequestDTO(row, historyBySubmissionId.get(Number(row.id)) ?? [])),
      total,
    };
  },
};

export function buildKwpFormFactoryQueryForTests(
  access: KwpFormReportAccess,
): Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]> {
  return buildFactoryQuery(access);
}

export function buildKwpFormRequestQueryForTests(
  query: ListKwpFormRequestsQuery,
  access: KwpFormReportAccess,
): Knex.QueryBuilder<SubmissionRow, SubmissionRow[]> {
  return buildRequestQuery(query, access);
}

export function toKwpFormRequestDTOForTests(
  row: SubmissionRow,
  statusHistory: KwpFormStatusHistoryDTO[],
): KwpFormRequestTableRowDTO {
  return toRequestDTO(row, statusHistory);
}

function buildFactoryQuery(
  access: KwpFormReportAccess,
): Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]> {
  const builder = db<FactoryTableRow>('factories as f')
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on(function joinFactoryKeys() {
        this.on('ef.factory_registration_no_new', '=', 'f.code')
          .orOn('ef.factory_registration_no_new', '=', 'f.fid')
          .orOn('ef.source_factory_id', '=', 'f.fid')
          .orOn('ef.source_factory_id', '=', 'f.code');
      }).andOnNull('ef.deleted_at');
    })
    .join('cems_wpms_connected_measurement_points as cp', function joinConnectedPoints() {
      this.on(function joinPointFactoryKeys() {
        this.on('cp.factory_id', '=', 'f.fid')
          .orOn('cp.factory_id', '=', 'f.code')
          .orOn('cp.factory_registration_no', '=', 'f.code');
      }).andOnNull('cp.deleted_at');
    })
    .whereNull('f.deleted_at')
    .select(
      'f.id as factory_id',
      'f.fid as factory_fid',
      'f.code as factory_code',
      'f.name as factory_name',
      'f.system_detail as factory_system_detail',
      'p.name_th as province_name',
      'p.region as province_region',
      'ef.factory_registration_no_old as old_registration_no',
      'ef.address as eligible_address',
      'ef.business_activity as eligible_business_activity',
      'ef.factory_type_sequence as eligible_factory_type_sequence',
    )
    .countDistinct<{ connected_point_count: number | string }>('cp.id as connected_point_count')
    .groupBy(
      'f.id',
      'f.fid',
      'f.code',
      'f.name',
      'f.system_detail',
      'p.name_th',
      'p.region',
      'ef.factory_registration_no_old',
      'ef.address',
      'ef.business_activity',
      'ef.factory_type_sequence',
    )
    .orderBy('f.name', 'asc')
    .orderBy('f.id', 'asc');

  applyFactoryAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]>;
}

function buildRequestQuery(
  query: ListKwpFormRequestsQuery,
  access: KwpFormReportAccess,
): Knex.QueryBuilder<SubmissionRow, SubmissionRow[]> {
  const builder = db<SubmissionRow>('kwp_form_submissions as s')
    .leftJoin('factories as f', function joinFactory() {
      this.on('f.fid', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .leftJoin('cems_wpms_connected_measurement_points as cp', 'cp.id', 's.connected_point_id')
    .whereNull('s.deleted_at')
    .select(
      's.id',
      's.submission_no',
      's.form_type',
      's.status',
      's.factory_id',
      's.factory_name',
      's.factory_registration_no',
      's.factory_address',
      's.industry_type',
      's.connected_point_id',
      's.point_code',
      's.point_name',
      's.point_type',
      's.submitted_at',
      's.reviewed_at',
      's.officer_note',
      's.created_at',
      's.updated_at',
      'p.name_th as province_name',
      'p.region as province_region',
      'cp.system_type',
    );

  if (query.formType) builder.where('s.form_type', query.formType);
  if (query.status) builder.where('s.status', query.status);
  if (query.factoryId) {
    const factoryId = query.factoryId;
    builder.where((factoryBuilder) => {
      factoryBuilder
        .where('s.factory_id', factoryId)
        .orWhere('s.factory_registration_no', factoryId)
        .orWhere('f.fid', factoryId)
        .orWhere('f.code', factoryId);
    });
  }

  applyFactoryAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<SubmissionRow, SubmissionRow[]>;
}

function applyFactoryAccessFilter(builder: Knex.QueryBuilder, access: KwpFormReportAccess): void {
  if (access.scope !== 'OWN_FACTORY') return;
  applyAssignedFactoryAccessFilter(builder, access.actorUserId);
}

function applyRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  regionalAccess: KwpFormReportAccess['regionalAccess'],
): void {
  const regions = [
    ...new Set((regionalAccess?.regions ?? []).map((region) => region.trim())),
  ].filter(Boolean);
  if (regions.length === 0) return;
  builder.whereIn('p.region', regions);
}

async function listStatusHistoryForSubmissions(
  submissionIds: Array<number | string>,
): Promise<Map<number, KwpFormStatusHistoryDTO[]>> {
  if (submissionIds.length === 0) return new Map();

  const rows = await db<StatusHistoryRow>('kwp_form_status_history as h')
    .leftJoin('users as u', 'u.id', 'h.changed_by')
    .whereIn('h.submission_id', submissionIds)
    .select(
      'h.id',
      'h.submission_id',
      'h.status',
      'h.note',
      'h.changed_by',
      'u.username as changed_by_username',
      'u.prename_th as changed_by_prename_th',
      'u.first_name as changed_by_first_name',
      'u.last_name as changed_by_last_name',
      'h.changed_at',
    )
    .orderBy('h.changed_at', 'asc')
    .orderBy('h.id', 'asc');

  return rows.reduce((map, row) => {
    const submissionId = Number(row.submission_id);
    const current = map.get(submissionId) ?? [];
    map.set(submissionId, [...current, toStatusHistoryDTO(row)]);
    return map;
  }, new Map<number, KwpFormStatusHistoryDTO[]>());
}

function toFactoryDTO(row: FactoryTableRow): KwpFormFactoryTableRowDTO {
  const { factoryClass } = splitFactoryTypeSequence(row.eligible_factory_type_sequence);
  return {
    id: row.factory_fid,
    factoryId: row.factory_fid,
    factoryName: row.factory_name,
    newRegistrationNo: row.factory_code,
    oldRegistrationNo: row.old_registration_no,
    industryType: row.factory_system_detail,
    industryMainOrder: factoryClass,
    businessActivity: row.eligible_business_activity,
    province: row.province_name,
    address: row.eligible_address,
    monitoringPointCount: Number(row.connected_point_count ?? 0),
  };
}

function toRequestDTO(
  row: SubmissionRow,
  statusHistory: KwpFormStatusHistoryDTO[],
): KwpFormRequestTableRowDTO {
  const submittedAt = row.submitted_at ?? row.created_at;
  return {
    id: Number(row.id),
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistration: row.factory_registration_no,
    industryType: row.industry_type,
    factoryAddress: row.factory_address,
    province: row.province_name,
    type: row.system_type ?? pointTypeToSystemType(row.point_type),
    monitoringPointCode: row.point_code,
    monitoringPointName: row.point_name,
    requestNo: row.submission_no,
    form: KWP_FORM_TYPE_LABELS[row.form_type],
    formType: row.form_type,
    submittedDate: submittedAt ? formatThaiDate(submittedAt) : '-',
    reviewedDate: row.reviewed_at ? formatThaiDate(row.reviewed_at) : '-',
    status: kwpFormStatusLabel(row.status, statusHistory),
    statusCode: row.status,
    revisionNote: row.officer_note,
    statusHistory,
  };
}

function toStatusHistoryDTO(row: StatusHistoryRow): KwpFormStatusHistoryDTO {
  return {
    id: Number(row.id),
    status: row.status,
    statusLabel: KWP_FORM_STATUS_LABELS[row.status],
    note: row.note,
    changedById: row.changed_by === null ? null : Number(row.changed_by),
    changedBy: displayUserName(row),
    changedAt: new Date(row.changed_at).toISOString(),
    changedDate: formatThaiDate(row.changed_at),
  };
}

function pointTypeToSystemType(pointType: string | null): 'CEMS' | 'WPMS' | string | null {
  if (pointType === 'STACK') return 'CEMS';
  if (pointType === 'WASTEWATER') return 'WPMS';
  return pointType;
}

function displayUserName(row: StatusHistoryRow): string | null {
  const fullName = [row.changed_by_prename_th, row.changed_by_first_name, row.changed_by_last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || row.changed_by_username;
}

function formatThaiDate(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear() + 543}`;
}

const KWP_FORM_TYPE_LABELS: Record<KwpFormType, string> = {
  KWP01: 'กวภ.01',
  KWP02: 'กวภ.02',
  KWP03: 'กวภ.03',
  KWP04: 'กวภ.04',
  KWP05: 'กวภ.05',
};

const KWP_FORM_STATUS_LABELS: Record<KwpFormStatus, string> = {
  DRAFT: 'แบบร่าง',
  SUBMITTED: 'รอพิจารณา',
  UNDER_REVIEW: 'รอพิจารณา',
  APPROVED: 'ผ่านการพิจารณา',
  REJECTED: 'ไม่ผ่านการพิจารณา',
  REVISION_REQUESTED: 'รอโรงงานแก้ไข',
  CANCELLED: 'ยกเลิก',
};

function kwpFormStatusLabel(
  status: KwpFormStatus,
  statusHistory: KwpFormStatusHistoryDTO[],
): string {
  if (
    status === 'SUBMITTED' &&
    statusHistory.some((history) => history.status === 'REVISION_REQUESTED')
  ) {
    return 'แก้ไขแล้ว/รอพิจารณา';
  }
  return KWP_FORM_STATUS_LABELS[status];
}
