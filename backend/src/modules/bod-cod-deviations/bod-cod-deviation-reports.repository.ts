import type { Knex } from 'knex';
import { db } from '../../config/database';
import type {
  BodCodApprovalTrack,
  BodCodDeviationAccess,
  BodCodConnectedMeasurementPointDTO,
  BodCodDeviationFactoryTableRowDTO,
  BodCodDeviationReportStatus,
  BodCodReportSlotDTO,
  BodCodDeviationReportTableRowDTO,
  BodCodParameterCode,
  ListBodCodDeviationReportsQuery,
} from './bod-cod-deviation-reports.types';

interface FactoryTableRow {
  connected_point_id: number | string;
  source_request_id: number | string;
  source_measurement_point_id: number | string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  factory_address: string | null;
  point_code: string | null;
  point_name: string;
  point_type: string;
  system_type: string;
  parameters_json: string;
  connected_at: Date | string | null;
  poms_factory_id: number | string | null;
  factory_fid: string | null;
  factory_code: string | null;
  factory_system_detail: string | null;
  province_name: string | null;
  province_region: string | null;
  industrial_estate_name: string | null;
  factory_registration_no_old: string | null;
  address: string | null;
  business_activity: string | null;
  eligible_factory_id: number | string | null;
}

interface ReportTableRow {
  id: number | string;
  report_no: string;
  report_round: number | string;
  report_year: number | string;
  factory_id: number | string | null;
  connected_measurement_point_id: number | string | null;
  point_code: string | null;
  point_name: string | null;
  factory_fid: string | null;
  factory_name: string;
  factory_registration_no: string;
  province_name: string;
  approval_track: BodCodApprovalTrack;
  selected_parameter_code: BodCodParameterCode;
  status: BodCodDeviationReportStatus;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  measurement_count: number | string | null;
}

export interface LatestReportRow {
  factory_id: number | string | null;
  connected_measurement_point_id: number | string | null;
  point_code: string | null;
  factory_registration_no: string;
  report_round: number | string;
  report_year: number | string;
  report_id: number | string;
  report_no: string;
  status: BodCodDeviationReportStatus;
}

export const bodCodDeviationReportsRepository = {
  async listFactories(
    access: BodCodDeviationAccess,
  ): Promise<{ rows: BodCodDeviationFactoryTableRowDTO[]; total: number }> {
    const rows = await buildFactoryQuery(access);
    const currentYear = currentBuddhistYear();
    const reports = await listCurrentYearReportsForConnectedPoints(rows, currentYear);
    const reportBySlotKey = buildLatestReportSlotMap(reports);
    const data = toConnectedFactoryDTOs(rows, reportBySlotKey, currentYear);

    return { rows: data, total: data.length };
  },

  async listReports(
    query: ListBodCodDeviationReportsQuery,
    access: BodCodDeviationAccess,
  ): Promise<{ rows: BodCodDeviationReportTableRowDTO[]; total: number }> {
    const baseQuery = buildReportQuery(query, access);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('r.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rows = await baseQuery.clone().orderBy('r.created_at', 'desc').orderBy('r.id', 'desc');
    return { rows: rows.map(toReportDTO), total };
  },
};

export function buildBodCodDeviationFactoryQueryForTests(access: BodCodDeviationAccess) {
  return buildFactoryQuery(access);
}

export function buildBodCodDeviationReportQueryForTests(
  query: ListBodCodDeviationReportsQuery,
  access: BodCodDeviationAccess,
) {
  return buildReportQuery(query, access);
}

export function buildBodCodDeviationLatestReportSlotMapForTests(reports: LatestReportRow[]) {
  return buildLatestReportSlotMap(reports);
}

function buildFactoryQuery(
  access: BodCodDeviationAccess,
): Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]> {
  const builder = db<FactoryTableRow>('cems_wpms_connected_measurement_points as cp')
    .leftJoin('factories as f', function joinPomsFactory() {
      this.on('f.fid', '=', 'cp.factory_id')
        .orOn('f.code', '=', 'cp.factory_id')
        .orOn('f.code', '=', 'cp.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on(function joinFactoryKeys() {
        this.on('ef.factory_registration_no_new', '=', 'cp.factory_registration_no')
          .orOn('ef.factory_registration_no_new', '=', 'cp.factory_id')
          .orOn('ef.source_factory_id', '=', 'cp.factory_id')
          .orOn('ef.source_factory_id', '=', 'f.fid')
          .orOn('ef.factory_registration_no_new', '=', 'f.code');
      }).andOnNull('ef.deleted_at');
    })
    .whereNull('cp.deleted_at')
    .select(
      'cp.id as connected_point_id',
      'cp.source_request_id',
      'cp.source_measurement_point_id',
      'cp.factory_id',
      'cp.factory_name',
      'cp.factory_registration_no',
      'cp.factory_address',
      'cp.point_code',
      'cp.point_name',
      'cp.point_type',
      'cp.system_type',
      'cp.parameters_json',
      'cp.connected_at',
      'f.id as poms_factory_id',
      'f.fid as factory_fid',
      'f.code as factory_code',
      'f.system_detail as factory_system_detail',
      'p.name_th as province_name',
      'p.region as province_region',
      'ie.name_th as industrial_estate_name',
      'ef.factory_registration_no_old',
      'ef.address',
      'ef.business_activity',
      'ef.id as eligible_factory_id',
    )
    .orderBy('cp.factory_name', 'asc')
    .orderBy('cp.factory_id', 'asc')
    .orderBy('cp.point_code', 'asc')
    .orderBy('cp.point_name', 'asc');

  applyFactoryAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]>;
}

function buildReportQuery(
  query: ListBodCodDeviationReportsQuery,
  access: BodCodDeviationAccess,
): Knex.QueryBuilder<ReportTableRow, ReportTableRow[]> {
  const measurementCounts = db('bod_cod_deviation_measurements')
    .whereNull('deleted_at')
    .select('report_id')
    .count<{ report_id: number | string; measurement_count: number | string }[]>({
      measurement_count: '*',
    })
    .groupBy('report_id')
    .as('m');

  const builder = db<ReportTableRow>('bod_cod_deviation_reports as r')
    .leftJoin('factories as f', function joinReportFactory() {
      this.on('f.id', '=', 'r.factory_id')
        .orOn('f.fid', '=', 'r.factory_registration_no')
        .orOn('f.code', '=', 'r.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.name_th', 'r.province_name')
    .leftJoin(measurementCounts, 'm.report_id', 'r.id')
    .whereNull('r.deleted_at')
    .select(
      'r.id',
      'r.report_no',
      'r.report_round',
      'r.report_year',
      'r.factory_id',
      'r.connected_measurement_point_id',
      'r.point_code',
      'r.point_name',
      'f.fid as factory_fid',
      'r.factory_name',
      'r.factory_registration_no',
      'r.province_name',
      'r.approval_track',
      'r.selected_parameter_code',
      'r.status',
      'r.submitted_at',
      'r.created_at',
      'r.updated_at',
      'm.measurement_count',
    );

  if (query.status) builder.where('r.status', query.status);
  if (query.parameterCode) builder.where('r.selected_parameter_code', query.parameterCode);
  if (query.factoryId) {
    const factoryId = query.factoryId;
    builder.where((factoryBuilder) => {
      factoryBuilder
        .where('r.factory_id', factoryId)
        .orWhere('f.fid', factoryId)
        .orWhere('f.code', factoryId)
        .orWhere('r.factory_registration_no', factoryId);
    });
  }

  applyReportAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<ReportTableRow, ReportTableRow[]>;
}

function applyFactoryAccessFilter(builder: Knex.QueryBuilder, access: BodCodDeviationAccess): void {
  if (access.scope !== 'OWN_FACTORY') return;
  builder
    .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
    .where('uj.user_id', access.actorUserId)
    .whereNull('uj.revoked_at');
}

function applyReportAccessFilter(builder: Knex.QueryBuilder, access: BodCodDeviationAccess): void {
  if (access.scope !== 'OWN_FACTORY') return;
  builder
    .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
    .where('uj.user_id', access.actorUserId)
    .whereNull('uj.revoked_at');
}

function applyRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  regionalAccess: BodCodDeviationAccess['regionalAccess'],
): void {
  const regions = [
    ...new Set((regionalAccess?.regions ?? []).map((region) => region.trim())),
  ].filter(Boolean);
  if (regions.length === 0) return;
  builder.whereIn('p.region', regions);
}

async function listCurrentYearReportsForConnectedPoints(
  rows: FactoryTableRow[],
  year: number,
): Promise<LatestReportRow[]> {
  const pointIds = rows
    .map((row) => row.connected_point_id)
    .filter((id): id is number | string => id !== null);
  const pointCodes = rows
    .map((row) => row.point_code)
    .filter((code): code is string => Boolean(code));
  if (pointIds.length === 0 && pointCodes.length === 0) return [];

  return db<LatestReportRow>('bod_cod_deviation_reports')
    .whereNull('deleted_at')
    .where('report_year', year)
    .where((builder) => {
      if (pointIds.length > 0) builder.whereIn('connected_measurement_point_id', pointIds);
      if (pointCodes.length > 0) builder.orWhereIn('point_code', pointCodes);
    })
    .select(
      'factory_id',
      'connected_measurement_point_id',
      'point_code',
      'factory_registration_no',
      'report_round',
      'report_year',
      'id as report_id',
      'report_no',
      'status',
    )
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');
}

function toConnectedFactoryDTOs(
  rows: FactoryTableRow[],
  reportBySlotKey: Map<string, LatestReportRow>,
  year: number,
): BodCodDeviationFactoryTableRowDTO[] {
  const factories = new Map<
    string,
    { firstRow: FactoryTableRow; points: BodCodConnectedMeasurementPointDTO[] }
  >();

  for (const row of rows) {
    const factoryId = connectedFactoryId(row);
    const current = factories.get(factoryId) ?? { firstRow: row, points: [] };
    const reportSlots = buildReportSlots(row, reportBySlotKey, year);
    const parameterCodes = parseParameters(row.parameters_json);
    current.points = [
      ...current.points,
      {
        id: Number(row.connected_point_id),
        stationId: row.point_code ?? row.point_name,
        code: row.point_code,
        name: row.point_name,
        type: row.system_type,
        parameters: parameterCodes.join(', '),
        parameterCodes,
        round1Status: reportSlots[0]?.statusLabel ?? 'ยังไม่ยื่น',
        round2Status: reportSlots[1]?.statusLabel ?? 'ยังไม่ยื่น',
        pointCode: row.point_code,
        pointName: row.point_name,
        pointType: row.point_type,
        systemType: row.system_type,
        reportSlots,
      },
    ];
    factories.set(factoryId, current);
  }

  return [...factories.entries()].map(([factoryId, factory]) =>
    toFactoryDTO(factoryId, factory.firstRow, factory.points),
  );
}

function buildReportSlots(
  row: FactoryTableRow,
  reportBySlotKey: Map<string, LatestReportRow>,
  year: number,
): BodCodReportSlotDTO[] {
  return ([1, 2] as const).map((roundNo) => {
    const report =
      reportBySlotKey.get(reportSlotKey(row.connected_point_id, roundNo)) ??
      reportBySlotKey.get(reportSlotKey(row.point_code, roundNo));
    return {
      roundNo,
      year,
      status: report?.status ?? 'NOT_SUBMITTED',
      statusLabel: report ? reportStatusLabel(report.status) : 'ยังไม่ยื่น',
      reportId: toNumberOrNull(report?.report_id ?? null),
      reportNo: report?.report_no ?? null,
    };
  });
}

function buildLatestReportSlotMap(reports: LatestReportRow[]): Map<string, LatestReportRow> {
  const reportBySlotKey = new Map<string, LatestReportRow>();
  for (const report of reports) {
    for (const key of reportSlotKeysForReport(report)) {
      if (!reportBySlotKey.has(key)) {
        reportBySlotKey.set(key, report);
      }
    }
  }
  return reportBySlotKey;
}

function toFactoryDTO(
  factoryId: string,
  row: FactoryTableRow,
  measurementPoints: BodCodConnectedMeasurementPointDTO[],
): BodCodDeviationFactoryTableRowDTO {
  const latestSlot = measurementPoints
    .flatMap((point) => point.reportSlots)
    .find((slot) => slot.reportId !== null);
  return {
    id: factoryId,
    factoryId,
    factoryName: row.factory_name,
    factoryRegistration: row.factory_registration_no,
    newRegistrationNo: row.factory_registration_no,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.business_activity ?? row.factory_system_detail,
    province: row.province_name,
    provinceName: row.province_name,
    regionName: row.province_region,
    industrialEstateName: row.industrial_estate_name,
    address: row.address ?? row.factory_address,
    eligibleFactoryId: toNumberOrNull(row.eligible_factory_id),
    monitoringPointCount: measurementPoints.length,
    measurementPoints,
    latestReportId: latestSlot?.reportId ?? null,
    latestReportNo: latestSlot?.reportNo ?? null,
    latestReportStatus:
      latestSlot?.status === 'NOT_SUBMITTED' ? null : (latestSlot?.status ?? null),
    latestReportStatusLabel:
      latestSlot?.status === 'NOT_SUBMITTED' ? null : (latestSlot?.statusLabel ?? null),
  };
}

function toReportDTO(row: ReportTableRow): BodCodDeviationReportTableRowDTO {
  const reportRoundNo = Number(row.report_round);
  const statusLabel = reportStatusLabel(row.status);
  return {
    id: Number(row.id),
    reportNo: row.report_no,
    reportRound: reportRoundLabel(reportRoundNo),
    reportRoundNo,
    reportYear: Number(row.report_year),
    year: Number(row.report_year),
    selectedParameterCode: row.selected_parameter_code,
    selectedParameterLabel: parameterLabel(row.selected_parameter_code),
    factoryId: row.factory_fid ?? (row.factory_id == null ? null : String(row.factory_id)),
    factoryName: row.factory_name,
    factoryRegistration: row.factory_registration_no,
    factoryRegistrationNo: row.factory_registration_no,
    monitoringPointId: toNumberOrNull(row.connected_measurement_point_id),
    monitoringPointCode: row.point_code,
    monitoringPointName: row.point_name,
    province: row.province_name,
    provinceName: row.province_name,
    approvalTrack: row.approval_track,
    status: statusLabel,
    statusCode: row.status,
    statusLabel,
    submittedDate: formatThaiDate(row.submitted_at),
    reviewedDate: reviewedDateLabel(row.status, row.updated_at),
    submittedAt: toDateTimeString(row.submitted_at),
    createdAt: toDateTimeString(row.created_at) ?? '',
    updatedAt: toDateTimeString(row.updated_at) ?? '',
    measurementCount: Number(row.measurement_count ?? 0),
  };
}

function connectedFactoryId(row: FactoryTableRow): string {
  return row.factory_fid ?? row.factory_id;
}

function reportSlotKey(pointId: number | string | null, roundNo: number | string): string {
  return `${pointId ?? ''}:${roundNo}`;
}

function reportSlotKeysForReport(report: LatestReportRow): string[] {
  return [
    reportSlotKey(report.connected_measurement_point_id, report.report_round),
    reportSlotKey(report.point_code, report.report_round),
  ].filter((key, index, keys) => key !== ':' && keys.indexOf(key) === index);
}

function currentBuddhistYear(): number {
  return new Date().getFullYear() + 543;
}

function parseParameters(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((parameter): parameter is string => typeof parameter === 'string')
      : [];
  } catch {
    return [];
  }
}

function parameterLabel(code: BodCodParameterCode): string {
  return code === 'BOD' ? 'BOD (mg/l)' : 'COD (mg/l)';
}

function reportRoundLabel(roundNo: number): string {
  return `ครั้งที่ ${roundNo}`;
}

function reportStatusLabel(status: BodCodDeviationReportStatus): string {
  const labels: Record<BodCodDeviationReportStatus, string> = {
    DRAFT: 'แบบร่าง',
    SUBMITTED: 'ส่งรายงานแล้ว',
    UNDER_REVIEW: 'รอพิจารณา',
    WAITING_APPROVAL: 'รออนุมัติ',
    APPROVED: 'ผ่านการพิจารณา',
    REVISION_REQUESTED: 'รอโรงงานแก้ไข',
    CANCELLED: 'ยกเลิก',
  };
  return labels[status];
}

function reviewedDateLabel(status: BodCodDeviationReportStatus, updatedAt: Date | string): string {
  if (status === 'DRAFT' || status === 'SUBMITTED' || status === 'UNDER_REVIEW') return '-';
  return formatThaiDate(updatedAt);
}

function formatThaiDate(value: Date | string | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toDateTimeString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}
