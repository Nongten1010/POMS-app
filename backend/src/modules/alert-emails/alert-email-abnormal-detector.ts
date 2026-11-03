import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DailyAlertCandidate, DailyAlertParameter } from './alert-email-daily-detector';
import type { AlertEmailPoint } from './alert-email-source.repository';
import {
  normalizeAlertActivationStationIdentity,
  parseRegisteredAlertParameter,
} from './alert-parameter-activations';
import { detectAbnormalHourlyEpisodes, type AlertHourlySample } from './alert-email-rules';

export const ABNORMAL_MINIMUM_HOURS = 5;
export const ABNORMAL_MINIMUM_READINGS = ABNORMAL_MINIMUM_HOURS + 1;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const timestampSchema = z.iso.datetime({ offset: true });

export interface BuildHourlyAbnormalAlertCandidatesInput {
  point: AlertEmailPoint;
  parameters: DailyAlertParameter[];
  detectedAt: string;
}

/** Current abnormal facts only; the persistent daily key enforces one alert across all types. */
export function buildHourlyAbnormalAlertCandidates(
  input: BuildHourlyAbnormalAlertCandidatesInput,
): DailyAlertCandidate[] {
  const detected = timestamp(input.detectedAt, 'detectedAt');
  if (!input.point.connectedAt) return [];
  const connected = timestamp(input.point.connectedAt, 'connectedAt');
  const date = bangkokDate(detected);
  const dayStart = Date.parse(`${date}T00:00:00+07:00`);
  const earliestFreshHour = Math.floor(detected / HOUR_MS) * HOUR_MS - HOUR_MS;
  const seen = new Set<string>();
  const candidates: DailyAlertCandidate[] = [];

  for (const parameter of input.parameters) {
    const registered = parseRegisteredAlertParameter(`${parameter.code} (${parameter.unit})`);
    if (!registered) throw new Error('A registered parameter and unit are required');
    if (seen.has(registered.key)) throw new Error('Duplicate parameter and unit');
    seen.add(registered.key);
    if (parameter.activationVerified && !parameter.activatedAt)
      throw new Error('Verified activation requires an activation timestamp');
    const activated = parameter.activatedAt
      ? parameter.activationVerified
        ? timestamp(parameter.activatedAt, 'activatedAt')
        : Math.max(connected, timestamp(parameter.activatedAt, 'activatedAt'))
      : connected;
    const samples = parameter.samples
      .filter((sample) => {
        const measured = Date.parse(sample.measuredAt);
        const actual = actualSampleTime(sample);
        return (
          Number.isFinite(measured) &&
          Number.isFinite(actual) &&
          actual >= activated &&
          actual <= detected &&
          measured <= detected
        );
      })
      .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
    const latest = samples[samples.length - 1];
    if (
      !latest ||
      Date.parse(latest.measuredAt) < earliestFreshHour ||
      actualSampleTime(latest) < dayStart
    )
      continue;

    const episodes = detectAbnormalHourlyEpisodes(
      samples,
      ABNORMAL_MINIMUM_READINGS,
      ABNORMAL_MINIMUM_HOURS * HOUR_MS,
    );
    const episode = episodes.find((item) => Date.parse(item.endedAt) === actualSampleTime(latest));
    if (!episode) continue;
    const firstToday = samples.find(
      (sample) =>
        actualSampleTime(sample) >= dayStart &&
        actualSampleTime(sample) >= Date.parse(episode.confirmedAt),
    );
    if (!firstToday) continue;
    const triggeredAt = firstToday.sourceMeasuredAt ?? firstToday.measuredAt;
    const unit = parameter.unit.trim();
    const name = parameter.name.trim() || parameter.code;
    const key = JSON.stringify([
      input.point.factoryId,
      input.point.systemType,
      normalizeAlertActivationStationIdentity(input.point.stationId),
      registered.parameterCode,
      unit.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
      date,
    ]);
    candidates.push({
      alert_type: 'ABNORMAL_VALUE',
      system_type: input.point.systemType,
      display_system_type: input.point.systemType === 'CEMS' ? 'CEMS' : 'BOD_COD_ONLINE',
      connected_measurement_point_id: input.point.id,
      factory_id: input.point.factoryId,
      factory_name: input.point.factoryName,
      factory_registration_no: input.point.factoryRegistrationNo,
      station_id: input.point.stationId,
      point_code: input.point.pointCode,
      point_name: input.point.pointName,
      point_type: input.point.pointType,
      parameter_code: parameter.code,
      parameter_name: name,
      parameter_label: name.includes(`(${unit})`) ? name : `${name} (${unit})`,
      unit,
      event_date: date,
      started_at: episode.startedAt,
      ended_at: episode.endedAt,
      measured_value: episode.measuredValue,
      threshold_value: null,
      threshold_type: null,
      completeness_percent: null,
      consecutive_days: null,
      abnormal_type: episode.abnormalType,
      abnormal_streak_count: episode.streakCount,
      first_abnormal_at: episode.startedAt,
      confirmed_abnormal_at: episode.confirmedAt,
      source_table: null,
      source_interval: '60m',
      source_payload_json: null,
      evidence_json: JSON.stringify({
        abnormalMode: 'HOURLY',
        abnormalHours: ABNORMAL_MINIMUM_HOURS,
        abnormalReadings: ABNORMAL_MINIMUM_READINGS,
        notificationDate: date,
        triggeredAt,
        parameterActivatedAt: new Date(activated).toISOString(),
        activationVerified: parameter.activationVerified === true,
        periodStartedAt: new Date(dayStart).toISOString(),
        periodEndedAt: new Date(dayStart + DAY_MS).toISOString(),
        ...episode,
        elapsedMilliseconds: Date.parse(episode.endedAt) - Date.parse(episode.startedAt),
      }),
      notification_status: 'AUTO',
      idempotency_key: `ABNORMAL_HOURLY:v1:${createHash('sha256').update(key).digest('hex')}`,
      detected_at: input.detectedAt,
    });
  }
  return candidates;
}

function actualSampleTime(sample: AlertHourlySample): number {
  return Date.parse(sample.sourceMeasuredAt ?? sample.measuredAt);
}

function timestamp(value: string, field: string): number {
  if (!timestampSchema.safeParse(value).success) throw new Error(`Invalid ${field}`);
  return Date.parse(value);
}

function bangkokDate(at: number): string {
  return new Date(at + 7 * HOUR_MS).toISOString().slice(0, 10);
}
