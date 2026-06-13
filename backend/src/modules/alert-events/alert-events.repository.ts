import { db } from '../../config/database';
import type {
  AlertEventDTO,
  AlertEventRow,
  ConnectedAlertMeasurementPointSnapshot,
  CreateIntegrationAlertEventInput,
  ListAlertEventsQuery,
  UpdateAlertEventStatusInput,
} from './alert-events.types';

interface ConnectedMeasurementPointRow {
  id: number | string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  point_code: string | null;
  point_name: string;
  point_type: string;
}

export const alertEventsRepository = {
  async findByIdempotencyKey(idempotencyKey: string): Promise<AlertEventDTO | null> {
    const row = await db<AlertEventRow>('alert_events')
      .where({ idempotency_key: idempotencyKey })
      .whereNull('deleted_at')
      .first();

    return row ? toAlertEventDTO(row) : null;
  },

  async findById(id: number): Promise<AlertEventDTO | null> {
    const row = await db<AlertEventRow>('alert_events')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    return row ? toAlertEventDTO(row) : null;
  },

  async findConnectedMeasurementPointByStation(input: {
    systemType: string;
    stationId: string;
    pointCode?: string | null;
  }): Promise<ConnectedAlertMeasurementPointSnapshot | null> {
    const lookupCodes = [...new Set([input.pointCode, input.stationId].filter(Boolean))] as string[];
    if (lookupCodes.length === 0) return null;

    const row = await db<ConnectedMeasurementPointRow>('cems_wpms_connected_measurement_points')
      .whereNull('deleted_at')
      .where('system_type', input.systemType)
      .whereIn('point_code', lookupCodes)
      .first(
        'id',
        'factory_id',
        'factory_name',
        'factory_registration_no',
        'point_code',
        'point_name',
        'point_type',
      );

    return row
      ? {
          id: Number(row.id),
          factoryId: row.factory_id,
          factoryName: row.factory_name,
          factoryRegistrationNo: row.factory_registration_no,
          pointCode: row.point_code,
          pointName: row.point_name,
          pointType: toAlertPointType(row.point_type),
        }
      : null;
  },

  async createFromIntegration(input: CreateIntegrationAlertEventInput): Promise<AlertEventDTO> {
    const payload = toInsertPayload(input);
    const inserted = await db<AlertEventRow>('alert_events').insert(payload).returning('*');
    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    if (row && typeof row === 'object' && 'id' in row) return toAlertEventDTO(row as AlertEventRow);

    const created = await this.findByIdempotencyKey(input.idempotencyKey);
    if (!created) throw new Error('Failed to create alert event');
    return created;
  },

  async list(query: ListAlertEventsQuery): Promise<{ rows: AlertEventDTO[]; total: number }> {
    const baseQuery = buildListQuery(query);
    const [{ total }] = await baseQuery.clone().clearSelect().clearOrder().count<{ total: number }[]>({
      total: '*',
    });

    const rows = await baseQuery
      .clone()
      .orderBy('event_date', 'desc')
      .orderBy('started_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .select<AlertEventRow[]>('*');

    return {
      rows: rows.map(toAlertEventDTO),
      total: Number(total),
    };
  },

  async updateStatus(
    id: number,
    input: UpdateAlertEventStatusInput,
    actorUserId: number,
  ): Promise<AlertEventDTO | null> {
    await db<AlertEventRow>('alert_events')
      .where({ id })
      .whereNull('deleted_at')
      .update({
        notification_status: input.notificationStatus,
        updated_by: actorUserId,
        updated_at: db.fn.now(),
      });

    return this.findById(id);
  },
};

function buildListQuery(query: ListAlertEventsQuery) {
  const builder = db<AlertEventRow>('alert_events').whereNull('deleted_at');

  if (query.systemType) builder.where('system_type', query.systemType);
  if (query.displaySystemType) builder.where('display_system_type', query.displaySystemType);
  if (query.alertType) builder.where('alert_type', query.alertType);
  if (query.thresholdType) builder.where('threshold_type', query.thresholdType);
  if (query.factoryId) builder.where('factory_id', query.factoryId);
  if (query.stationId) builder.where('station_id', query.stationId);
  if (query.parameterCode) builder.where('parameter_code', query.parameterCode);
  if (query.dateFrom) builder.where('event_date', '>=', query.dateFrom);
  if (query.dateTo) builder.where('event_date', '<=', query.dateTo);

  return builder;
}

function toInsertPayload(input: CreateIntegrationAlertEventInput) {
  return {
    idempotency_key: input.idempotencyKey,
    alert_type: input.alertType,
    system_type: input.systemType,
    display_system_type: input.displaySystemType,
    factory_id: input.factoryId ?? null,
    factory_name: input.factoryName ?? '',
    factory_registration_no: input.factoryRegistrationNo ?? null,
    connected_measurement_point_id: input.connectedMeasurementPointId ?? null,
    station_id: input.stationId,
    point_code: input.pointCode ?? null,
    point_name: input.pointName,
    point_type: input.pointType ?? null,
    parameter_code: input.parameterCode,
    parameter_name: input.parameterName,
    parameter_label: input.parameterLabel,
    unit: input.unit,
    event_date: input.eventDate,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    measured_value: input.measuredValue,
    threshold_value: input.thresholdValue,
    threshold_type: input.thresholdType,
    notification_status: input.notificationStatus ?? 'AUTO',
    source_payload_json: input.sourcePayload ? JSON.stringify(input.sourcePayload) : null,
  };
}

function toAlertPointType(value: string) {
  if (value === 'STACK' || value === 'WASTEWATER' || value === 'OTHER') return value;
  return 'OTHER';
}

function toAlertEventDTO(row: AlertEventRow): AlertEventDTO {
  const eventDate = toDateString(row.event_date);
  const startedAt = toDateTimeString(row.started_at);
  const endedAt = toDateTimeString(row.ended_at);
  const notificationStatus = row.notification_status;

  return {
    id: Number(row.id),
    idempotencyKey: row.idempotency_key,
    alertType: row.alert_type,
    systemType: row.system_type,
    displaySystemType: row.display_system_type,
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    stationId: row.station_id,
    pointCode: row.point_code,
    pointName: row.point_name,
    pointType: row.point_type,
    parameterCode: row.parameter_code,
    parameterName: row.parameter_name,
    parameterLabel: row.parameter_label,
    unit: row.unit,
    eventDate,
    eventDateText: formatThaiShortDate(eventDate),
    timeRange: formatTimeRange(startedAt, endedAt),
    startedAt,
    endedAt,
    measuredValue: toNumberOrNull(row.measured_value),
    thresholdValue: toNumberOrNull(row.threshold_value),
    thresholdType: row.threshold_type,
    thresholdLabel: thresholdLabel(row.threshold_type),
    completenessPercent: toNumberOrNull(row.completeness_percent),
    completenessPercentText: formatPercent(row.completeness_percent),
    consecutiveDays: toIntegerOrNull(row.consecutive_days),
    abnormalType: row.abnormal_type,
    abnormalLabel: abnormalLabel(row.abnormal_type),
    abnormalStreakCount: toIntegerOrNull(row.abnormal_streak_count),
    firstAbnormalAt: toDateTimeString(row.first_abnormal_at),
    confirmedAbnormalAt: toDateTimeString(row.confirmed_abnormal_at),
    notificationStatus,
    notificationStatusLabel: notificationStatusLabel(notificationStatus),
    sourcePayload: parseJsonObject(row.source_payload_json),
    detectedAt: toDateTimeString(row.detected_at) ?? '',
  };
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toDateTimeString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toIntegerOrNull(value: unknown): number | null {
  const numberValue = toNumberOrNull(value);
  return numberValue === null ? null : Math.trunc(numberValue);
}

function formatThaiShortDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${monthNames[month - 1]}-${String(year + 543).slice(-2)}`;
}

function formatTimeRange(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  return `${formatHourMinute(startedAt)} - ${formatHourMinute(endedAt)}`;
}

function formatHourMinute(value: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[1]}.${match[2]}`;
}

function thresholdLabel(value: string | null): string | null {
  if (value === 'STANDARD') return 'ค่ามาตรฐาน';
  if (value === 'EIA') return 'ค่า EIA';
  return null;
}

function notificationStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    AUTO: 'อัตโนมัติ',
    OFFICER: 'โดยเจ้าหน้าที่',
    ACKNOWLEDGED: 'รับทราบแล้ว',
    DISMISSED: 'ยกเลิก',
  };
  return labels[value] ?? value;
}

function abnormalLabel(value: string | null): string | null {
  const labels: Record<string, string> = {
    CONSTANT: 'ค่านิ่ง',
    ZERO: 'ค่าเป็น 0',
    NEGATIVE: 'ค่าติดลบ',
  };
  return value ? (labels[value] ?? value) : null;
}

function formatPercent(value: unknown): string | null {
  const numberValue = toNumberOrNull(value);
  return numberValue === null ? null : numberValue.toFixed(2);
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
