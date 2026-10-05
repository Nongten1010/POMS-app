import { createHash } from 'node:crypto';
import type { AlertEventRow } from '../alert-events/alert-events.types';
import type { AlertEmailPoint } from './alert-email-source.repository';
import { normalizeAlertActivationStationIdentity } from './alert-parameter-activations';
import {
  countConsecutiveLowReportingDays,
  detectAbnormalHourlyEpisodes,
  summarizeAlertDay,
} from './alert-email-rules';
import type {
  AlertCompletenessPolicy,
  AlertDaySummary,
  AlertHourlySample,
  ExemptDayPolicy,
} from './alert-email-rules';

export interface DailyAlertParameter {
  code: string;
  name: string;
  unit: string;
  /** Earliest trusted activation of the current parameter/unit registration. */
  activatedAt?: string;
  /** Persisted registry evidence survives replacement of a continuously connected live point. */
  activationVerified?: boolean;
  samples: AlertHourlySample[];
  dailySummaries: AlertDaySummary[];
}

export interface BuildDailyAlertCandidatesInput {
  point: AlertEmailPoint;
  parameters: DailyAlertParameter[];
  /** Completed reporting date in Asia/Bangkok. */
  date: string;
  detectedAt: string;
  completenessPolicy: AlertCompletenessPolicy;
  exemptDayPolicy: ExemptDayPolicy;
  abnormalReadings: number;
}

export type DailyAlertCandidate = Omit<
  AlertEventRow,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'deleted_at'
>;

const DAY_MS = 86_400_000;

/** Produces facts only. It never evaluates standards/EIA, writes SQL, or sends email. */
export function buildDailyAlertCandidates(
  input: BuildDailyAlertCandidatesInput,
): DailyAlertCandidate[] {
  validatePolicy(input);
  const start = reportingDayStart(input.date);
  const end = start + DAY_MS;
  const detected = timestamp(input.detectedAt, 'detectedAt');
  if (detected < end) throw new Error('Daily detection requires a completed reporting day');
  if (input.point.connectedAt === null) return [];
  const connected = timestamp(input.point.connectedAt, 'connectedAt');

  const candidates: DailyAlertCandidate[] = [];
  const uniqueParameters = new Set<string>();
  for (const parameter of input.parameters) {
    if (parameter.activationVerified && !parameter.activatedAt)
      throw new Error('Verified activation requires an activation timestamp');
    const effectiveConnected = parameter.activatedAt
      ? parameter.activationVerified
        ? timestamp(parameter.activatedAt, 'activatedAt')
        : Math.max(connected, timestamp(parameter.activatedAt, 'activatedAt'))
      : connected;
    if (effectiveConnected > start) continue;
    const normalizedUnit = normalizeUnit(parameter.unit);
    const parameterIdentity = JSON.stringify([
      parameter.activationVerified
        ? canonicalParameterCode(parameter.code)
        : parameter.code.trim().toUpperCase(),
      normalizedUnit,
    ]);
    if (uniqueParameters.has(parameterIdentity)) throw new Error('Duplicate parameter and unit');
    uniqueParameters.add(parameterIdentity);
    const relevantSamples = parameter.samples.filter((sample) => {
      const measured = Date.parse(sample.measuredAt);
      return Number.isFinite(measured) && measured >= effectiveConnected && measured < end;
    });
    const summary = summarizeAlertDay(input.date, relevantSamples, input.completenessPolicy);
    const sharedEvidence = {
      completenessPolicy: input.completenessPolicy,
      exemptDayPolicy: input.exemptDayPolicy,
      abnormalReadings: input.abnormalReadings,
      expectedCount: summary.expectedCount,
      receivedCount: summary.receivedCount,
      completenessPercent: summary.completenessPercent,
      reportingDate: input.date,
      parameterActivatedAt: new Date(effectiveConnected).toISOString(),
      activationVerified: parameter.activationVerified === true,
      periodStartedAt: new Date(start).toISOString(),
      periodEndedAt: new Date(end).toISOString(),
    };
    const base = baseCandidate(input, parameter, start, end);
    if (summary.lowCompleteness === true) {
      candidates.push({
        ...base,
        alert_type: 'DAILY_COMPLETENESS_LOW',
        idempotency_key: candidateKey(input, parameter, 'DAILY_COMPLETENESS_LOW'),
        completeness_percent: summary.completenessPercent,
        evidence_json: JSON.stringify(sharedEvidence),
      });
    }

    const history = parameter.dailySummaries.filter((day) => {
      const dayStart = reportingDayStart(day.date);
      return dayStart >= effectiveConnected && dayStart <= start && day.date !== input.date;
    });
    const consecutive = countConsecutiveLowReportingDays(
      [...history, summary],
      input.date,
      input.exemptDayPolicy,
    );
    const consecutiveThreshold = input.point.systemType === 'CEMS' ? 15 : 8;
    if (summary.lowCompleteness === true && consecutive.count >= consecutiveThreshold) {
      candidates.push({
        ...base,
        alert_type: 'CONSECUTIVE_NO_REPORT',
        idempotency_key: candidateKey(input, parameter, 'CONSECUTIVE_NO_REPORT'),
        completeness_percent: summary.completenessPercent,
        consecutive_days: consecutive.count,
        evidence_json: JSON.stringify({
          ...sharedEvidence,
          ...consecutive,
          consecutiveThreshold,
          includesMissingAndLowReportingDays: true,
        }),
      });
    }

    const episodes = detectAbnormalHourlyEpisodes(relevantSamples, input.abnormalReadings);
    for (const episode of episodes) {
      if (Date.parse(episode.endedAt) < start || Date.parse(episode.confirmedAt) >= end) continue;
      candidates.push({
        ...base,
        alert_type: 'ABNORMAL_VALUE',
        idempotency_key: candidateKey(
          input,
          parameter,
          'ABNORMAL_VALUE',
          `${episode.abnormalType}:${parameter.activationVerified ? new Date(timestamp(episode.startedAt, 'startedAt')).toISOString() : episode.startedAt}`,
        ),
        started_at: episode.startedAt,
        ended_at: episode.endedAt,
        measured_value: episode.measuredValue,
        abnormal_type: episode.abnormalType,
        abnormal_streak_count: episode.streakCount,
        first_abnormal_at: episode.startedAt,
        confirmed_abnormal_at: episode.confirmedAt,
        evidence_json: JSON.stringify({
          ...sharedEvidence,
          abnormalReadings: input.abnormalReadings,
          ...episode,
          elapsedMilliseconds: Date.parse(episode.endedAt) - Date.parse(episode.startedAt),
        }),
      });
    }
  }
  return candidates.sort((left, right) =>
    left.idempotency_key < right.idempotency_key
      ? -1
      : left.idempotency_key > right.idempotency_key
        ? 1
        : 0,
  );
}

function baseCandidate(
  input: BuildDailyAlertCandidatesInput,
  parameter: DailyAlertParameter,
  start: number,
  end: number,
): DailyAlertCandidate {
  const point = input.point;
  const name = parameter.name.trim() || parameter.code;
  const unit = parameter.unit.trim();
  return {
    alert_type: 'DAILY_COMPLETENESS_LOW',
    system_type: point.systemType,
    display_system_type: point.systemType === 'CEMS' ? 'CEMS' : 'BOD_COD_ONLINE',
    connected_measurement_point_id: point.id,
    factory_id: point.factoryId,
    factory_name: point.factoryName,
    factory_registration_no: point.factoryRegistrationNo,
    station_id: point.stationId,
    point_code: point.pointCode,
    point_name: point.pointName,
    point_type: point.pointType,
    parameter_code: parameter.code,
    parameter_name: name,
    parameter_label: name.includes(`(${unit})`) ? name : `${name} (${unit})`,
    unit,
    event_date: input.date,
    started_at: new Date(start).toISOString(),
    ended_at: new Date(end).toISOString(),
    measured_value: null,
    threshold_value: null,
    threshold_type: null,
    completeness_percent: null,
    consecutive_days: null,
    abnormal_type: null,
    abnormal_streak_count: null,
    first_abnormal_at: null,
    confirmed_abnormal_at: null,
    source_table: null,
    source_interval: '60m',
    source_payload_json: null,
    evidence_json: null,
    notification_status: 'AUTO',
    idempotency_key: '',
    detected_at: input.detectedAt,
  };
}

function candidateKey(
  input: BuildDailyAlertCandidatesInput,
  parameter: DailyAlertParameter,
  alertType: DailyAlertCandidate['alert_type'],
  episodeIdentity: string | null = null,
): string {
  const activation = parameter.activatedAt
    ? new Date(timestamp(parameter.activatedAt, 'activatedAt')).toISOString()
    : null;
  const verified = parameter.activationVerified === true;
  if (verified && (!input.point.factoryId.trim() || !input.point.stationId.trim()))
    throw new Error('Verified activation requires a factory and station identity');
  const identity = [
    ...(verified
      ? [
          'daily-alert-v2',
          input.point.factoryId.trim(),
          input.point.systemType,
          normalizeAlertActivationStationIdentity(input.point.stationId),
          canonicalParameterCode(parameter.code),
        ]
      : [
          'daily-alert-v1',
          input.point.id,
          input.point.systemType,
          parameter.code.trim().toUpperCase(),
        ]),
    normalizeUnit(parameter.unit),
    activation,
    input.date,
    input.completenessPolicy,
    input.exemptDayPolicy,
    input.abnormalReadings,
    alertType,
    episodeIdentity,
  ];
  return dailyAlertKey(verified ? 'v2' : 'v1', identity);
}

/** Compare a verified candidate with the original v1 key without trusting old evidence fields. */
export function legacyDailyAlertKey(
  candidate: DailyAlertCandidate,
  oldPointId: number,
): string | null {
  if (!candidate.idempotency_key.startsWith('DAILY_ALERT:v2:')) return null;
  if (!Number.isSafeInteger(oldPointId) || oldPointId <= 0) return null;
  let evidence: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(candidate.evidence_json ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    evidence = parsed as Record<string, unknown>;
  } catch {
    throw new Error('Invalid daily alert identity metadata');
  }
  if (
    evidence.activationVerified !== true ||
    typeof evidence.parameterActivatedAt !== 'string' ||
    (evidence.completenessPolicy !== 'ON_TIME' &&
      evidence.completenessPolicy !== 'NORMAL_EXCLUDING_SHUTDOWN') ||
    (evidence.exemptDayPolicy !== 'RESET' && evidence.exemptDayPolicy !== 'PAUSE') ||
    typeof evidence.abnormalReadings !== 'number' ||
    !Number.isInteger(evidence.abnormalReadings) ||
    evidence.abnormalReadings < 2 ||
    typeof candidate.event_date !== 'string'
  )
    throw new Error('Invalid daily alert identity metadata');
  reportingDayStart(candidate.event_date);
  const activation = new Date(
    timestamp(evidence.parameterActivatedAt, 'activatedAt'),
  ).toISOString();
  let episodeIdentity: string | null = null;
  if (candidate.alert_type === 'ABNORMAL_VALUE') {
    if (!candidate.abnormal_type || typeof candidate.started_at !== 'string')
      throw new Error('Invalid daily alert identity metadata');
    timestamp(candidate.started_at, 'started_at');
    // v1 hashed the original source spelling, including its offset and source minutes.
    episodeIdentity = `${candidate.abnormal_type}:${candidate.started_at}`;
  }
  return dailyAlertKey('v1', [
    'daily-alert-v1',
    oldPointId,
    candidate.system_type,
    candidate.parameter_code.trim().toUpperCase(),
    normalizeUnit(candidate.unit ?? ''),
    activation,
    candidate.event_date,
    evidence.completenessPolicy,
    evidence.exemptDayPolicy,
    evidence.abnormalReadings,
    candidate.alert_type,
    episodeIdentity,
  ]);
}

function dailyAlertKey(version: 'v1' | 'v2', identity: unknown[]): string {
  return `DAILY_ALERT:${version}:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`;
}

function canonicalParameterCode(value: string): string {
  const code = value.normalize('NFKC').trim().toLowerCase();
  if (!code) throw new Error('A registered parameter code is required');
  return code;
}

function normalizeUnit(value: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error('A registered unit is required');
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function reportingDayStart(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid reporting date');
  const calendarDate = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(calendarDate) ||
    new Date(calendarDate).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Invalid reporting date');
  }
  return Date.parse(`${value}T00:00:00+07:00`);
}

function timestamp(value: string, field: string): number {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new Error(`${field} requires a timezone`);
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${field}`);
  return result;
}

function validatePolicy(input: BuildDailyAlertCandidatesInput): void {
  if (
    input.completenessPolicy !== 'ON_TIME' &&
    input.completenessPolicy !== 'NORMAL_EXCLUDING_SHUTDOWN'
  ) {
    throw new Error('An explicit completeness policy is required');
  }
  if (input.exemptDayPolicy !== 'RESET' && input.exemptDayPolicy !== 'PAUSE') {
    throw new Error('An explicit exempt-day policy is required');
  }
  if (!Number.isInteger(input.abnormalReadings) || input.abnormalReadings < 2) {
    throw new Error('At least two abnormal hourly readings are required');
  }
}
