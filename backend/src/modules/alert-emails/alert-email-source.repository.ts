import { z } from 'zod';
import { db } from '../../config/database';
import { toAlertEventDTO } from '../alert-events/alert-events.repository';
import type { AlertEventDTO, AlertEventRow } from '../alert-events/alert-events.types';
import { normalizeAlertEventUnit } from '../alert-events/alert-event-identity';
import { createIntegrationAlertEventSchema } from '../alert-events/alert-events.validator';
import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';

export interface AlertEmailPoint {
  id: number;
  systemType: 'CEMS' | 'WPMS';
  stationId: string;
  pointCode: string;
  pointName: string;
  pointType: 'STACK' | 'WASTEWATER' | 'OTHER';
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  connectedAt: string | null;
  officerEmails: string[];
  factoryEmails: string[];
}

interface ConnectedPointEmailRow {
  id: number | string;
  system_type: AlertEmailPoint['systemType'];
  point_code: string;
  point_name: string;
  point_type: string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  connected_at: Date | string | null;
  live_officer_emails_json: string | null;
  live_factory_emails_json: string | null;
  source_officer_emails_json: string | null;
  source_factory_emails_json: string | null;
}

export interface AlertEmailSourcePeriod {
  cadence: 'HOURLY' | 'DAILY';
  startAt: string;
  endAt: string;
}

const emailSchema = z.email();
const HOUR_MS = 3_600_000;

/** Read current connected points; the factory master is never a source of recipients. */
export const alertEmailSourceRepository = {
  async listPoints(): Promise<AlertEmailPoint[]> {
    const rows = await connectedPointsQuery().orderBy('cp.id', 'asc');
    return rows.map(toAlertEmailPoint);
  },

  async listEvents(period: AlertEmailSourcePeriod): Promise<AlertEventDTO[]> {
    const start = Date.parse(period.startAt);
    const end = Date.parse(period.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Invalid alert email source period');
    }
    const query = db<AlertEventRow>('alert_events')
      .whereNull('deleted_at')
      .whereNot('notification_status', 'DISMISSED');
    if (period.cadence === 'HOURLY') {
      query
        .whereIn('alert_type', ['STANDARD_EXCEEDED', 'EIA_EXCEEDED'])
        .where('event_date', '>=', bangkokDate(start))
        .where('event_date', '<=', bangkokDate(end - 1));
    } else {
      query
        .whereIn('alert_type', [
          'DAILY_COMPLETENESS_LOW',
          'CONSECUTIVE_NO_REPORT',
          'ABNORMAL_VALUE',
        ])
        .where('event_date', bangkokDate(start));
    }
    const rows = await query.orderBy('id', 'asc').select('*');
    if (period.cadence === 'DAILY') return rows.map(toAlertEventDTO);
    // Legacy DATETIME2 values can lose their offset. The original validated
    // Bangkok event date/hour is the only safe reconstruction for hourly mail.
    return rows.flatMap((row) => hourlyEventInPeriod(row, start, end));
  },

  async findPointForEvent(event: AlertEventDTO): Promise<AlertEmailPoint | null> {
    if (!event.factoryId || !event.stationId) return null;
    const row = await connectedPointsQuery()
      .where('cp.point_code', event.stationId)
      .where('cp.system_type', event.systemType)
      .where('cp.factory_id', event.factoryId)
      .first();
    if (!row) return null;
    // Fail closed if a view or future query change returns a different ownership snapshot.
    if (
      row.factory_id !== event.factoryId ||
      row.point_code !== event.stationId ||
      row.system_type !== event.systemType
    )
      return null;
    return toAlertEmailPoint(row);
  },
};

function bangkokDate(timestamp: number): string {
  return new Date(timestamp + 7 * HOUR_MS).toISOString().slice(0, 10);
}

function hourlyEventInPeriod(row: AlertEventRow, start: number, end: number): AlertEventDTO[] {
  if (!row.source_payload_json) return [];
  try {
    const parsed = createIntegrationAlertEventSchema.safeParse(JSON.parse(row.source_payload_json));
    if (!parsed.success) return [];
    const input = parsed.data;
    if (
      input.systemType !== row.system_type ||
      input.stationId !== row.station_id ||
      input.parameterCode !== row.parameter_code.toLowerCase() ||
      normalizeAlertEventUnit(input.unit) !== normalizeAlertEventUnit(row.unit ?? '') ||
      input.alertType !== row.alert_type
    )
      return [];
    const startedAt = Date.parse(input.startedAt);
    const endedAt = Date.parse(input.endedAt);
    if (startedAt < start || endedAt >= end) return [];
    return [
      toAlertEventDTO({ ...row, started_at: new Date(startedAt), ended_at: new Date(endedAt) }),
    ];
  } catch {
    return [];
  }
}

function connectedPointsQuery() {
  return (
    db<ConnectedPointEmailRow>(
      factoryProfileReadTable('cems_wpms_connected_measurement_points', 'cp'),
    )
      // The canonical view predates contact columns; always read live metadata from the base row.
      .innerJoin('cems_wpms_connected_measurement_points as cp_live', 'cp_live.id', 'cp.id')
      .leftJoin('cems_wpms_connection_requests as source_request', function joinSourceRequest() {
        this.on('source_request.id', '=', 'cp.source_request_id').andOnNull(
          'source_request.deleted_at',
        );
      })
      .whereNull('cp.deleted_at')
      .whereNull('cp_live.deleted_at')
      .whereNotNull('cp.point_code')
      .whereIn('cp.system_type', ['CEMS', 'WPMS'])
      .select(
        'cp.id',
        'cp.system_type',
        'cp.point_code',
        'cp.point_name',
        'cp.point_type',
        'cp.factory_id',
        'cp.factory_name',
        'cp.factory_registration_no',
        'cp.connected_at',
        'cp_live.officer_notification_emails_json as live_officer_emails_json',
        'cp_live.notification_emails_json as live_factory_emails_json',
        'source_request.officer_notification_emails_json as source_officer_emails_json',
        'source_request.notification_emails_json as source_factory_emails_json',
      )
  );
}

function toAlertEmailPoint(row: ConnectedPointEmailRow): AlertEmailPoint {
  return {
    id: Number(row.id),
    systemType: row.system_type,
    stationId: row.point_code,
    pointCode: row.point_code,
    pointName: row.point_name,
    pointType:
      row.point_type === 'STACK' || row.point_type === 'WASTEWATER' ? row.point_type : 'OTHER',
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    connectedAt:
      row.connected_at instanceof Date ? row.connected_at.toISOString() : row.connected_at,
    // NULL inherits; [] and malformed non-NULL JSON deliberately resolve to no recipients.
    officerEmails: parseRecipients(row.live_officer_emails_json ?? row.source_officer_emails_json),
    factoryEmails: parseRecipients(row.live_factory_emails_json ?? row.source_factory_emails_json),
  };
}

function parseRecipients(value: string | null): string[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.flatMap((item: unknown) => {
          if (typeof item !== 'string') return [];
          const email = item.trim().toLowerCase();
          return emailSchema.safeParse(email).success ? [email] : [];
        }),
      ),
    ];
  } catch {
    return [];
  }
}
