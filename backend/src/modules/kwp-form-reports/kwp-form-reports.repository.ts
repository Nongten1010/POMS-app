import type { Knex } from 'knex';
import { db } from '../../config/database';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { applyFactoryType88Filter } from '../../shared/utils/factory-type-scope';
import { splitFactoryTypeSequence } from '../eligible-factories/factory-type-sequence';
import type { PermissionScopeDetails } from '../auth/permissions';
import { resolveAssignedRegions } from '../auth/regional-access';
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
  factory_registration_no_new: string;
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
  current_factory_name?: string | null;
  current_factory_registration_no?: string | null;
  old_registration_no?: string | null;
  current_province_name?: string | null;
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

export function toKwpFormFactoryDTOForTests(row: FactoryTableRow): KwpFormFactoryTableRowDTO {
  return toFactoryDTO(row);
}

export function toKwpFormStatusHistoryDTOForTests(row: StatusHistoryRow): KwpFormStatusHistoryDTO {
  return toStatusHistoryDTO(row);
}

function buildFactoryQuery(
  access: KwpFormReportAccess,
): Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]> {
  const builder = db<FactoryTableRow>('factories as f')
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ef_source.*
        FROM eligible_factories AS ef_source
        WHERE ef_source.deleted_at IS NULL
          AND (
            ef_source.factory_registration_no_new = f.fid
            OR ef_source.source_factory_id = f.fid
            OR ef_source.factory_registration_no_new = f.code
            OR ef_source.source_factory_id = f.code
            OR ef_source.factory_registration_no_old = f.code
          )
        ORDER BY CASE
          WHEN ef_source.factory_registration_no_new = f.fid THEN 0
          WHEN ef_source.source_factory_id = f.fid THEN 1
          WHEN ef_source.factory_registration_no_old = f.code THEN 2
          WHEN ef_source.factory_registration_no_new = f.code THEN 3
          ELSE 4
        END, ef_source.id DESC
      ) AS ef
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) p_source.*
        FROM provinces AS p_source
        WHERE p_source.name_th = ef.province_name
          OR (ef.id IS NULL AND p_source.id = f.province_id)
        ORDER BY p_source.id
      ) AS p
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ie_source.*
        FROM industrial_estates AS ie_source
        WHERE ie_source.name_th = ef.industrial_estate_name
          OR (ef.id IS NULL AND ie_source.id = f.industrial_estate_id)
        ORDER BY ie_source.id
      ) AS ie
    `,
    )
    .join('cems_wpms_connected_measurement_points as cp', function joinConnectedPoints() {
      this.on('cp.eligible_factory_id', '=', 'ef.id').andOnNull('cp.deleted_at');
    })
    .whereNull('f.deleted_at')
    .select(
      'f.id as factory_id',
      'f.fid as factory_fid',
      db.raw('COALESCE(ef.factory_registration_no_new, f.fid) as factory_registration_no_new'),
      db.raw(`
        COALESCE(
          (
            SELECT TOP (1) cp_name.factory_name
            FROM cems_wpms_connected_measurement_points AS cp_name
            WHERE cp_name.eligible_factory_id = ef.id
              AND cp_name.deleted_at IS NULL
            ORDER BY cp_name.updated_at DESC, cp_name.id DESC
          ),
          ef.factory_name,
          f.name
        ) as factory_name
      `),
      'f.system_detail as factory_system_detail',
      db.raw('COALESCE(ef.province_name, p.name_th) as province_name'),
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
      'f.name',
      'f.system_detail',
      'p.name_th',
      'p.region',
      'ef.id',
      'ef.factory_name',
      'ef.factory_registration_no_new',
      'ef.factory_registration_no_old',
      'ef.province_name',
      'ef.address',
      'ef.business_activity',
      'ef.factory_type_sequence',
    )
    .orderBy('f.name', 'asc')
    .orderBy('f.id', 'asc');

  applyFactoryAccessFilter(builder, access);
  applyLocationScopeFilter(builder, access.scope);
  applyRegionalAccessFilter(builder, access.scope, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]>;
}

function buildRequestQuery(
  query: ListKwpFormRequestsQuery,
  access: KwpFormReportAccess,
): Knex.QueryBuilder<SubmissionRow, SubmissionRow[]> {
  const builder = db<SubmissionRow>('kwp_form_submissions as s')
    .leftJoin('cems_wpms_connected_measurement_points as cp', function joinConnectedPoint() {
      this.on('cp.id', '=', 's.connected_point_id').andOnNull('cp.deleted_at');
    })
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ef_source.*
        FROM eligible_factories AS ef_source
        WHERE ef_source.deleted_at IS NULL
          AND (
            ef_source.id = cp.eligible_factory_id
            OR ef_source.factory_registration_no_new = cp.factory_registration_no
            OR ef_source.factory_registration_no_new = cp.factory_id
            OR ef_source.source_factory_id = cp.factory_id
            OR ef_source.factory_registration_no_old = s.factory_registration_no
            OR ef_source.factory_registration_no_new = s.factory_registration_no
            OR ef_source.factory_registration_no_new = s.factory_id
            OR ef_source.source_factory_id = s.factory_id
          )
        ORDER BY CASE
          WHEN ef_source.id = cp.eligible_factory_id THEN 0
          WHEN ef_source.factory_registration_no_new = cp.factory_registration_no THEN 1
          WHEN ef_source.factory_registration_no_new = cp.factory_id THEN 2
          WHEN ef_source.source_factory_id = cp.factory_id THEN 3
          WHEN ef_source.factory_registration_no_old = s.factory_registration_no THEN 4
          WHEN ef_source.factory_registration_no_new = s.factory_registration_no THEN 5
          WHEN ef_source.factory_registration_no_new = s.factory_id THEN 6
          ELSE 7
        END, ef_source.id DESC
      ) AS ef
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) f_source.*
        FROM factories AS f_source
        WHERE f_source.deleted_at IS NULL
          AND (
            f_source.fid = ef.source_factory_id
            OR f_source.fid = ef.factory_registration_no_new
            OR f_source.code = ef.factory_registration_no_old
            OR f_source.fid = cp.factory_id
            OR f_source.code = cp.factory_registration_no
            OR f_source.fid = s.factory_id
            OR f_source.code = s.factory_id
            OR f_source.code = s.factory_registration_no
          )
        ORDER BY CASE
          WHEN f_source.fid = ef.source_factory_id THEN 0
          WHEN f_source.fid = ef.factory_registration_no_new THEN 1
          WHEN f_source.code = ef.factory_registration_no_old THEN 2
          WHEN f_source.fid = cp.factory_id THEN 3
          WHEN f_source.fid = s.factory_id THEN 4
          WHEN f_source.code = s.factory_registration_no THEN 5
          ELSE 6
        END, f_source.id DESC
      ) AS f
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) p_source.*
        FROM provinces AS p_source
        WHERE p_source.name_th = ef.province_name
          OR (ef.id IS NULL AND p_source.id = f.province_id)
        ORDER BY p_source.id
      ) AS p
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ie_source.*
        FROM industrial_estates AS ie_source
        WHERE ie_source.name_th = ef.industrial_estate_name
          OR (ef.id IS NULL AND ie_source.id = f.industrial_estate_id)
        ORDER BY ie_source.id
      ) AS ie
    `,
    )
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
      db.raw(
        'COALESCE(cp.factory_name, ef.factory_name, f.name, s.factory_name) as current_factory_name',
      ),
      db.raw(
        'COALESCE(ef.factory_registration_no_new, f.fid, cp.factory_registration_no, s.factory_registration_no) as current_factory_registration_no',
      ),
      'ef.factory_registration_no_old as old_registration_no',
      db.raw('COALESCE(ef.province_name, p.name_th) as current_province_name'),
      submissionRegionSelect(),
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
        .orWhere('cp.factory_id', factoryId)
        .orWhere('cp.factory_registration_no', factoryId)
        .orWhere('ef.source_factory_id', factoryId)
        .orWhere('ef.factory_registration_no_new', factoryId)
        .orWhere('ef.factory_registration_no_old', factoryId)
        .orWhere('f.fid', factoryId)
        .orWhere('f.code', factoryId);
    });
  }

  applyFactoryAccessFilter(builder, access);
  applyLocationScopeFilter(builder, access.scope);
  applyRegionalAccessFilter(builder, access.scope, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<SubmissionRow, SubmissionRow[]>;
}

function applyFactoryAccessFilter(builder: Knex.QueryBuilder, access: KwpFormReportAccess): void {
  if (scopeValue(access.scope) !== 'OWN_FACTORY') return;
  applyAssignedFactoryAccessFilter(builder, access.actorUserId);
}

function applyLocationScopeFilter(
  builder: Knex.QueryBuilder,
  scope: KwpFormReportAccess['scope'],
): void {
  const details = scopeDetails(scope);
  if (scopeValue(scope) === 'FACTORY_TYPE_88') {
    applyFactoryType88Filter(builder, 'ef.factory_type_sequence');
    return;
  }
  if (!details) return;

  if (details.scope === 'IN_PROVINCE') {
    if (!details.province) {
      builder.whereRaw('1 = ?', [0]);
      return;
    }
    builder.where('p.name_th', details.province);
    return;
  }

  if (details.scope === 'IN_ESTATE') {
    const estateCode = toEstateCode(scope);
    if (estateCode) {
      builder.where('ie.code', estateCode);
      return;
    }
    const estateId = toEstateId(scope);
    if (estateId) {
      builder.where('ie.id', estateId);
      return;
    }
    builder.whereRaw('1 = ?', [0]);
  }
}

function applyRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  scope: KwpFormReportAccess['scope'],
  regionalAccess: KwpFormReportAccess['regionalAccess'],
): void {
  if (scopeValue(scope) !== 'IN_REGION') return;
  const details = scopeDetails(scope);
  const regions = resolveAssignedRegions(details?.region, regionalAccess);
  if (regions.length === 0) {
    builder.whereRaw('1 = ?', [0]);
    return;
  }
  builder.whereIn('p.region', regions);
}

function scopeValue(scope: KwpFormReportAccess['scope']): string | null | undefined {
  return typeof scope === 'object' && scope !== null ? scope.scope : scope;
}

function scopeDetails(
  scope: KwpFormReportAccess['scope'],
): PermissionScopeDetails | null {
  return typeof scope === 'object' && scope !== null ? scope : null;
}

function toEstateId(scope: KwpFormReportAccess['scope']): string | number | null {
  if (typeof scope !== 'object' || scope === null) return null;
  const value = (scope as PermissionScopeDetails & { estateId?: string | number | null }).estateId;
  return value ?? null;
}

function toEstateCode(scope: KwpFormReportAccess['scope']): string | null {
  if (typeof scope !== 'object' || scope === null) return null;
  const value =
    (scope as PermissionScopeDetails & { estateCode?: string | null }).estateCode ??
    (scope as PermissionScopeDetails & { estate?: string | null }).estate;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function submissionRegionSelect(): Knex.Raw {
  return db.raw('COALESCE(??, ??) as ??', [
    's.submission_region_name',
    'p.region',
    'province_region',
  ]);
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
    newRegistrationNo: row.factory_registration_no_new,
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
    factoryName: row.current_factory_name ?? row.factory_name,
    factoryRegistration: row.current_factory_registration_no ?? row.factory_registration_no,
    oldRegistrationNo: row.old_registration_no ?? null,
    industryType: row.industry_type,
    factoryAddress: row.factory_address,
    province: row.current_province_name ?? row.province_name,
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
