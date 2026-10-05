import { resolvePomsClientParameterStatus } from '../parameter-values/parameter-status';

export type AlertCompletenessPolicy = 'ON_TIME' | 'NORMAL_EXCLUDING_SHUTDOWN';
export type ExemptDayPolicy = 'RESET' | 'PAUSE';

export interface AlertHourlySample {
  measuredAt: string;
  sourceMeasuredAt?: string;
  abnormalEligible?: boolean;
  reportedAt: string | null;
  value: number | null;
  status: string | number | null;
}

export interface AlertDaySummary {
  date: string;
  expectedCount: number;
  receivedCount: number;
  completenessPercent: number | null;
  lowCompleteness: boolean | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS;

/** A reporting percentage is a per-parameter count of distinct hours. */
export function summarizeAlertDay(
  date: string,
  samples: AlertHourlySample[],
  policy: AlertCompletenessPolicy,
): AlertDaySummary {
  const start = Date.parse(`${date}T00:00:00+07:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(start) ||
    new Date(start + BANGKOK_OFFSET_MS).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Invalid summary date');
  }
  const received = new Set<number>();
  const shutdown = new Set<number>();
  for (const sample of samples) {
    const at = Date.parse(sample.measuredAt);
    if (!Number.isFinite(at) || at < start || at >= start + DAY_MS) continue;
    const hour = Math.floor((at - start) / HOUR_MS);
    const status = resolvePomsClientParameterStatus(sample.status);
    if (status?.code === 6) shutdown.add(hour);
    if (sample.value === null || !Number.isFinite(sample.value)) continue;
    if (policy === 'NORMAL_EXCLUDING_SHUTDOWN') {
      if (status?.usesMeasurementValue) received.add(hour);
    } else {
      const reported = sample.reportedAt === null ? NaN : Date.parse(sample.reportedAt);
      const hourStart = start + hour * HOUR_MS;
      if (Number.isFinite(reported) && reported < hourStart + HOUR_MS) received.add(hour);
    }
  }
  if (policy === 'NORMAL_EXCLUDING_SHUTDOWN') {
    for (const hour of shutdown) received.delete(hour);
  }
  const expected = policy === 'ON_TIME' ? 24 : 24 - shutdown.size;
  return {
    date,
    expectedCount: expected,
    receivedCount: received.size,
    completenessPercent: expected > 0 ? Math.round((received.size / expected) * 10000) / 100 : null,
    lowCompleteness: expected > 0 ? received.size * 5 < expected * 4 : null,
  };
}

export function countConsecutiveLowReportingDays(
  days: Pick<AlertDaySummary, 'date' | 'lowCompleteness'>[],
  endDate: string,
  exemptDayPolicy: ExemptDayPolicy,
): { count: number; startedOn: string | null; endedOn: string } {
  const byDate = new Map(days.map((day) => [day.date, day]));
  let count = 0;
  let startedOn: string | null = null;
  for (let date = endDate; ; date = previousDate(date)) {
    const day = byDate.get(date);
    if (!day || day.lowCompleteness === false) break;
    if (day.lowCompleteness === null) {
      if (exemptDayPolicy === 'RESET') break;
      continue;
    }
    count += 1;
    startedOn = date;
  }
  return { count, startedOn, endedOn: endDate };
}

export interface AbnormalHourlyEpisode {
  abnormalType: 'CONSTANT' | 'ZERO' | 'NEGATIVE';
  startedAt: string;
  confirmedAt: string;
  endedAt: string;
  streakCount: number;
  measuredValue: number;
}

/** Inputs are hourly readings; missing hours and non-Normal statuses break a sequence. */
export function detectAbnormalHourlyEpisodes(
  samples: AlertHourlySample[],
  minimumReadings: number,
): AbnormalHourlyEpisode[] {
  if (!Number.isInteger(minimumReadings) || minimumReadings < 2) {
    throw new Error('At least two hourly readings are required');
  }
  const unique = new Map<number, AlertHourlySample>();
  for (const sample of samples) {
    const at = Date.parse(sample.measuredAt);
    if (Number.isFinite(at) && !unique.has(at)) unique.set(at, sample);
  }
  const rows = [...unique.entries()].sort(([a], [b]) => a - b);
  const episodes: AbnormalHourlyEpisode[] = [];
  let streak: AlertHourlySample[] = [];
  let previousAt: number | null = null;
  let type: AbnormalHourlyEpisode['abnormalType'] | null = null;
  const flush = (): void => {
    if (type && streak.length >= minimumReadings) {
      episodes.push({
        abnormalType: type,
        startedAt: streak[0].sourceMeasuredAt ?? streak[0].measuredAt,
        confirmedAt:
          streak[minimumReadings - 1].sourceMeasuredAt ?? streak[minimumReadings - 1].measuredAt,
        endedAt: streak[streak.length - 1].sourceMeasuredAt ?? streak[streak.length - 1].measuredAt,
        streakCount: streak.length,
        measuredValue: streak[streak.length - 1].value as number,
      });
    }
    streak = [];
    type = null;
  };
  for (const [at, sample] of rows) {
    const normal = resolvePomsClientParameterStatus(sample.status)?.usesMeasurementValue;
    if (
      !normal ||
      sample.abnormalEligible === false ||
      sample.value === null ||
      !Number.isFinite(sample.value)
    ) {
      flush();
      previousAt = null;
      continue;
    }
    const nextType = sample.value === 0 ? 'ZERO' : sample.value < 0 ? 'NEGATIVE' : 'CONSTANT';
    const sameValue = nextType !== 'CONSTANT' || streak[streak.length - 1]?.value === sample.value;
    if (previousAt !== null && (at - previousAt !== HOUR_MS || type !== nextType || !sameValue))
      flush();
    type = nextType;
    streak.push(sample);
    previousAt = at;
  }
  flush();
  return episodes;
}

export interface AlertEmailPeriod {
  startAt: string;
  endAt: string;
  scheduledAt: string;
}

/** Latest due windows; a durable batch key handles restarts without repeat delivery. */
export function latestAlertEmailPeriods(
  now: Date,
  hourlyDelayMinutes: number,
): { hourly: AlertEmailPeriod; daily: AlertEmailPeriod } {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isInteger(hourlyDelayMinutes) ||
    hourlyDelayMinutes < 0 ||
    hourlyDelayMinutes > 59
  ) {
    throw new Error('Invalid dispatch time or hourly delay');
  }
  const delay = hourlyDelayMinutes * 60_000;
  const dueHour = Math.floor((now.getTime() - delay) / HOUR_MS) * HOUR_MS;
  const bangkokDayStart =
    Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
  let dailyDue = bangkokDayStart + 9 * HOUR_MS;
  if (dailyDue > now.getTime()) dailyDue -= DAY_MS;
  const dayStart = dailyDue - 9 * HOUR_MS;
  return {
    hourly: {
      startAt: new Date(dueHour - HOUR_MS).toISOString(),
      endAt: new Date(dueHour).toISOString(),
      scheduledAt: new Date(dueHour + delay).toISOString(),
    },
    daily: {
      startAt: new Date(dayStart - DAY_MS).toISOString(),
      endAt: new Date(dayStart).toISOString(),
      scheduledAt: new Date(dailyDue).toISOString(),
    },
  };
}

function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}
