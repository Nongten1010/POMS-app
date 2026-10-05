import { z } from 'zod';
import { db } from '../../config/database';
import { toAlertEventDTO } from '../alert-events/alert-events.repository';
import type { AlertEventDTO, AlertEventRow } from '../alert-events/alert-events.types';
import { normalizeAlertEventUnit } from '../alert-events/alert-event-identity';
import { createIntegrationAlertEventSchema } from '../alert-events/alert-events.validator';
import type { AlertEmailRenderContext } from './alert-email-template';
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
const calendarDateSchema = z.iso.date();

interface AlertEmailRenderContextRow {
  event_id: number | string;
  event_factory_id: string | null;
  event_system_type: AlertEventDTO['systemType'];
  event_station_id: string;
  event_date: Date | string;
  event_alert_type: AlertEventDTO['alertType'];
  point_factory_id: string;
  point_system_type: AlertEventDTO['systemType'];
  point_code: string;
  factory_province_name: string | null;
  evidence_json: string | null;
}

/** Read current connected points; the factory master is never a source of recipients. */
export const alertEmailSourceRepository = {
  async loadRenderContext(
    events: AlertEventDTO[],
  ): Promise<Record<number, AlertEmailRenderContext>> {
    const context: Record<number, AlertEmailRenderContext> = {};
    const ownedEvents = [...new Map(events.map((event) => [event.id, event])).values()].filter(
      (event) => {
        if (!Number.isSafeInteger(event.id) || event.id <= 0)
          throw new Error('Invalid alert event ID');
        context[event.id] = { factoryProvinceName: null, reportingStartedOn: null };
        return Boolean(event.factoryId && event.stationId);
      },
    );
    // Each identity binds four values, leaving headroom below SQL Server's 2,100 limit.
    for (let offset = 0; offset < ownedEvents.length; offset += 200) {
      const chunk = ownedEvents.slice(offset, offset + 200);
      const rows = await db<AlertEmailRenderContextRow>('alert_events as ae')
        .innerJoin(
          factoryProfileReadTable('cems_wpms_connected_measurement_points', 'cp'),
          function joinPoint() {
            this.on('cp.factory_id', '=', 'ae.factory_id')
              .andOn('cp.system_type', '=', 'ae.system_type')
              .andOn('cp.point_code', '=', 'ae.station_id');
          },
        )
        .leftJoin(
          factoryProfileReadTable('eligible_factories', 'eligible_factory'),
          function joinEligibleFactory() {
            this.on('eligible_factory.id', '=', 'cp.eligible_factory_id').andOnNull(
              'eligible_factory.deleted_at',
            );
          },
        )
        .whereNull('ae.deleted_at')
        .whereNull('cp.deleted_at')
        .where(function boundEventIdentities() {
          for (const event of chunk) {
            this.orWhere({
              'ae.id': event.id,
              'ae.factory_id': event.factoryId,
              'ae.system_type': event.systemType,
              'ae.station_id': event.stationId,
            });
          }
        })
        .select(
          'ae.id as event_id',
          'ae.factory_id as event_factory_id',
          'ae.system_type as event_system_type',
          'ae.station_id as event_station_id',
          'ae.event_date',
          'ae.alert_type as event_alert_type',
          'ae.evidence_json',
          'cp.factory_id as point_factory_id',
          'cp.system_type as point_system_type',
          'cp.point_code',
          'eligible_factory.province_name as factory_province_name',
        )
        .limit(1001);
      if (rows.length >= 1001) throw new Error('Alert email rendering metadata limit exceeded');
      for (const event of chunk) {
        const matches = rows.filter((row) => Number(row.event_id) === event.id);
        // Multiple active matches are ambiguous; never pick a province from the first row.
        if (matches.length !== 1) continue;
        const row = matches[0];
        const eventDate =
          row.event_date instanceof Date
            ? row.event_date.toISOString().slice(0, 10)
            : row.event_date;
        if (
          row.event_factory_id !== event.factoryId ||
          row.point_factory_id !== event.factoryId ||
          row.event_system_type !== event.systemType ||
          row.point_system_type !== event.systemType ||
          row.event_station_id !== event.stationId ||
          row.point_code !== event.stationId ||
          row.event_alert_type !== event.alertType ||
          eventDate !== event.eventDate
        )
          continue;
        context[event.id] = {
          factoryProvinceName:
            typeof row.factory_province_name === 'string'
              ? row.factory_province_name.trim() || null
              : null,
          reportingStartedOn:
            event.alertType === 'CONSECUTIVE_NO_REPORT'
              ? reportingStartedOn(row.evidence_json, event.eventDate)
              : null,
        };
      }
    }
    return context;
  },

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

function reportingStartedOn(value: string | null, eventDate: string): string | null {
  if (!value || !calendarDateSchema.safeParse(eventDate).success) return null;
  try {
    const evidence: unknown = JSON.parse(value);
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null;
    const stored = evidence as Record<string, unknown>;
    if (
      stored.reportingDate !== eventDate ||
      stored.endedOn !== eventDate ||
      typeof stored.startedOn !== 'string' ||
      !calendarDateSchema.safeParse(stored.startedOn).success ||
      stored.startedOn > eventDate
    )
      return null;
    return stored.startedOn;
  } catch {
    return null;
  }
}
