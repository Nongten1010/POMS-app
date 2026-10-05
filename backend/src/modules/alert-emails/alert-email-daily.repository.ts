import { z } from 'zod';
import { db } from '../../config/database';
import { alertEventsRepository, toAlertEventDTO } from '../alert-events/alert-events.repository';
import type { AlertEventDTO, AlertEventRow } from '../alert-events/alert-events.types';
import type { DailyAlertCandidate } from './alert-email-daily-detector';

const timestampSchema = z.iso.datetime({ offset: true });

/** Persist detector facts once; no recipient addresses or source credentials belong here. */
export const alertEmailDailyRepository = {
  async create(candidate: DailyAlertCandidate): Promise<AlertEventDTO> {
    if (
      typeof candidate.idempotency_key !== 'string' ||
      candidate.idempotency_key.trim() === '' ||
      candidate.idempotency_key.length > 220
    ) {
      throw new Error('Invalid daily alert idempotency key');
    }
    const payload = toInsertPayload(candidate);
    const existing = await alertEventsRepository.findByIdempotencyKey(candidate.idempotency_key);
    if (existing) return existing;

    try {
      const inserted = await db<AlertEventRow>('alert_events').insert(payload).returning('*');
      const row = Array.isArray(inserted) ? inserted[0] : inserted;
      if (row && typeof row === 'object' && 'id' in row)
        return toAlertEventDTO(row as AlertEventRow);
      const created = await alertEventsRepository.findByIdempotencyKey(candidate.idempotency_key);
      if (!created) throw new Error('Failed to create daily alert event');
      return created;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const winner = await alertEventsRepository.findByIdempotencyKey(candidate.idempotency_key);
        if (winner) return winner;
      }
      throw error;
    }
  },
};

function toInsertPayload(candidate: DailyAlertCandidate): DailyAlertCandidate {
  return {
    idempotency_key: candidate.idempotency_key,
    alert_type: candidate.alert_type,
    system_type: candidate.system_type,
    display_system_type: candidate.display_system_type,
    factory_id: candidate.factory_id,
    factory_name: candidate.factory_name,
    factory_registration_no: candidate.factory_registration_no,
    connected_measurement_point_id: candidate.connected_measurement_point_id,
    station_id: candidate.station_id,
    point_code: candidate.point_code,
    point_name: candidate.point_name,
    point_type: candidate.point_type,
    parameter_code: candidate.parameter_code,
    parameter_name: candidate.parameter_name,
    parameter_label: candidate.parameter_label,
    unit: candidate.unit,
    event_date: candidate.event_date,
    // Passing Date objects lets the MSSQL driver bind instants in UTC instead of
    // silently stripping an offset from a varchar assigned to DATETIME2.
    started_at: utcDate(candidate.started_at, 'started_at'),
    ended_at: utcDate(candidate.ended_at, 'ended_at'),
    measured_value: candidate.measured_value,
    threshold_value: candidate.threshold_value,
    threshold_type: candidate.threshold_type,
    completeness_percent: candidate.completeness_percent,
    consecutive_days: candidate.consecutive_days,
    abnormal_type: candidate.abnormal_type,
    abnormal_streak_count: candidate.abnormal_streak_count,
    first_abnormal_at: utcDate(candidate.first_abnormal_at, 'first_abnormal_at'),
    confirmed_abnormal_at: utcDate(candidate.confirmed_abnormal_at, 'confirmed_abnormal_at'),
    source_table: candidate.source_table,
    source_interval: candidate.source_interval,
    source_payload_json: null,
    evidence_json: candidate.evidence_json,
    notification_status: 'AUTO',
    detected_at: utcDate(candidate.detected_at, 'detected_at', true),
  };
}

function utcDate(value: unknown, field: string, required = false): Date | null {
  if (value === null || value === undefined) {
    if (!required) return null;
    throw new Error(`Invalid daily alert ${field}`);
  }
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : typeof value === 'string' && timestampSchema.safeParse(value).success
        ? new Date(value)
        : null;
  if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid daily alert ${field}`);
  return date;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as Record<string, unknown>;
  if (value.number === 2601 || value.number === 2627) return true;
  if (!value.originalError || typeof value.originalError !== 'object') return false;
  const original = value.originalError as Record<string, unknown>;
  if (original.number === 2601 || original.number === 2627) return true;
  const info = original.info;
  if (!info || typeof info !== 'object') return false;
  return (
    (info as Record<string, unknown>).number === 2601 ||
    (info as Record<string, unknown>).number === 2627
  );
}
