import { createHash } from 'node:crypto';
import { createIntegrationAlertEventSchema } from '../alert-events/alert-events.validator';
import type {
  CreateIntegrationAlertEventInput,
  AlertEventSystemType,
} from '../alert-events/alert-events.types';
import { parseRegisteredAlertParameter } from '../alert-emails/alert-parameter-activations';
import {
  measurementParameterUnitMatches,
  parseMeasurementParameter,
  resolveMeasurementParameterFamilies,
} from '../parameter-values/measurement-parameter-columns';
import { resolvePomsClientParameterStatus } from '../parameter-values/parameter-status';

export const HOUR_MS = 3_600_000;
export const ceilHour = (date: Date): Date =>
  new Date(Math.ceil(date.getTime() / HOUR_MS) * HOUR_MS);

export interface ExceedanceParameter {
  label: string;
  activatedAt: string;
  standard: unknown;
  eia: unknown;
  standardEnabled?: boolean;
  eiaEnabled?: boolean;
}

export interface ExceedancePoint {
  id: number;
  stationId: string;
  systemType: AlertEventSystemType;
  fingerprint: string;
  parameters: ExceedanceParameter[];
}

export interface ExceedanceEvaluation {
  events: CreateIntegrationAlertEventInput[];
  issues: string[];
  sourceFingerprint?: string;
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** SQL DECIMAL(18,6) must preserve an exceedance through the existing mail guard. */
function storableExceedance(value: number, threshold: number): boolean {
  const bound = 1_000_000_000_000;
  return (
    Math.abs(value) < bound &&
    Math.abs(threshold) < bound &&
    Number(value.toFixed(6)) > Number(threshold.toFixed(6))
  );
}

export function sourceHourLabel(hour: Date, label: 'START' | 'END') {
  const local = new Date(
    hour.getTime() + (label === 'END' ? HOUR_MS : 0) + 7 * HOUR_MS,
  ).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 13) + ':00' };
}

/** Confirmed START/END labels require an exact hourly aggregate, never an arbitrary raw minute. */
export function isSourceHour(
  row: Record<string, unknown>,
  expected: { date: string; time: string },
): boolean {
  const date = row.cdate instanceof Date ? row.cdate.toISOString().slice(0, 10) : row.cdate;
  const time = row.ctime instanceof Date ? row.ctime.toISOString().slice(11, 19) : row.ctime;
  return (
    date === expected.date &&
    typeof time === 'string' &&
    new RegExp(`^${expected.time}(?::00(?:\\.0+)?)?$`).test(time.trim())
  );
}

export function evaluateExceedanceHour(
  point: ExceedancePoint,
  hour: Date,
  rows: Record<string, unknown>[],
): ExceedanceEvaluation {
  const events: CreateIntegrationAlertEventInput[] = [];
  const issues = new Set<string>();
  const sourceFingerprint = fingerprint(
    [
      ...new Set(
        rows.map((row) =>
          JSON.stringify(
            Object.fromEntries(
              Object.keys(row)
                .sort()
                .map((key) => [key, row[key]]),
            ),
          ),
        ),
      ),
    ].sort(),
  );
  if (point.parameters.length === 0)
    return { events, issues: ['CONFIG_UNAVAILABLE'], sourceFingerprint };
  if (
    point.parameters.every(
      (parameter) => parameter.standardEnabled === false && parameter.eiaEnabled === false,
    )
  )
    return { events, issues: [], sourceFingerprint };
  if (rows.length === 0) return { events, issues: ['WAITING_DATA'], sourceFingerprint };
  const local = sourceHourLabel(hour, 'START');
  for (const parameter of point.parameters) {
    if (parameter.standardEnabled === false && parameter.eiaEnabled === false) continue;
    const registered = parseRegisteredAlertParameter(parameter.label);
    if (!registered || !Number.isFinite(Date.parse(parameter.activatedAt))) {
      issues.add('INVALID_PARAMETER');
      continue;
    }
    if (hour.getTime() < Date.parse(parameter.activatedAt)) continue;
    const readings: Array<{ value: number; status: number }> = [];
    for (const row of rows) {
      const families = resolveMeasurementParameterFamilies(Object.keys(row), parameter.label);
      const matches = families.flatMap((family) => {
        const value = family.valueColumn ? finiteNumber(row[family.valueColumn]) : null;
        const status = family.statusColumn
          ? resolvePomsClientParameterStatus(row[family.statusColumn])?.code
          : null;
        if (
          !family.unitsColumn ||
          !measurementParameterUnitMatches(
            parseMeasurementParameter(parameter.label),
            row[family.unitsColumn],
          ) ||
          value === null ||
          status === null ||
          status === undefined
        )
          return [];
        return [{ value, status }];
      });
      if (matches.length === 0) issues.add('INVALID_OR_MISSING_READING');
      readings.push(...matches);
    }
    if (readings.length === 0) continue;
    const first = readings[0];
    if (
      readings.some((reading) => reading.value !== first.value || reading.status !== first.status)
    ) {
      issues.add('CONFLICTING_READINGS');
      continue;
    }
    if (first.status !== 1) continue;
    for (const [thresholdType, raw] of [
      ['STANDARD', parameter.standard],
      ['EIA', parameter.eia],
    ] as const) {
      if (
        thresholdType === 'STANDARD'
          ? parameter.standardEnabled === false
          : parameter.eiaEnabled === false
      )
        continue;
      const threshold = finiteNumber(raw);
      if (threshold === null) {
        issues.add(`${thresholdType}_CONFIG_UNAVAILABLE`);
        continue;
      }
      if (first.value <= threshold) continue;
      if (!storableExceedance(first.value, threshold)) {
        issues.add('DECIMAL_PRECISION');
        continue;
      }
      events.push(
        createIntegrationAlertEventSchema.parse({
          systemType: point.systemType,
          stationId: point.stationId,
          pointCode: point.stationId,
          parameterCode: registered.parameterCode,
          unit: registered.unit,
          eventDate: local.date,
          time: local.time,
          measuredValue: first.value,
          thresholdValue: threshold,
          thresholdType,
        }),
      );
    }
  }
  return { events, issues: [...issues], sourceFingerprint };
}
