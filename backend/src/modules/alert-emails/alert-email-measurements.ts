import { z } from 'zod';
import { integrationDeviceConfigsService } from '../integrations/integration-device-configs.service';
import { parameterValuesRepository } from '../parameter-values/parameter-values.repository';
import { readRegisteredAlertMeasurement } from '../parameter-values/parameter-values.service';
import type { AlertEmailPoint } from './alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from './alert-email-policy';
import type { DailyAlertParameter } from './alert-email-daily-detector';
import { summarizeAlertDay, type AlertHourlySample } from './alert-email-rules';
import {
  alertParameterActivationKey,
  parseRegisteredAlertParameter,
} from './alert-parameter-activations';
import { listActiveAlertParameterActivations } from './alert-parameter-activations.repository';

const DAY_MS = 86_400_000;
const isoTimestamp = z.iso.datetime({ offset: true });

export async function loadAlertEmailParameters(
  point: AlertEmailPoint,
  date: string,
  policy: ActiveAlertEmailPolicy,
): Promise<DailyAlertParameter[]> {
  if (!point.connectedAt) return [];
  const connected = Date.parse(point.connectedAt);
  if (!Number.isFinite(connected)) throw new Error('Invalid connection timestamp');
  const end = Date.parse(`${date}T00:00:00+07:00`);
  if (!isoTimestamp.safeParse(`${date}T00:00:00+07:00`).success)
    throw new Error('Invalid reporting date');
  const { parameterConfigs } = await integrationDeviceConfigsService.getByStationId(
    point.stationId,
  );
  const activationRows = await listActiveAlertParameterActivations(point.id);
  const activations = new Map<string, string>();
  for (const activation of activationRows) {
    if (!isoTimestamp.safeParse(activation.activatedAt).success)
      throw new Error('Invalid registered activation timestamp');
    const key = alertParameterActivationKey(activation.parameterCode, activation.unit);
    if (activations.has(key)) throw new Error('Ambiguous registered parameter activation');
    activations.set(key, activation.activatedAt);
  }
  const parameters = new Map<
    string,
    { code: string; name: string; unit: string; label: string; activatedAt: string }
  >();
  for (const parameter of parameterConfigs) {
    if (parameter.testMode || !parameter.parameterUnit?.trim() || !parameter.parameterName?.trim())
      continue;
    const name = parameter.parameterName.trim();
    const unit = parameter.parameterUnit.trim();
    const registered = parseRegisteredAlertParameter(parameter.parameter);
    const requested = parseRegisteredAlertParameter(`${name} (${unit})`);
    if (!registered || !requested || registered.key !== requested.key) continue;
    const activatedAt = activations.get(registered.key);
    if (!activatedAt) continue;
    parameters.set(registered.key, {
      code: registered.parameterCode,
      name,
      unit,
      label: `${name} (${unit})`,
      activatedAt,
    });
  }
  if (parameters.size === 0) return [];
  const tableName = parameterValuesRepository.tableName(point.stationId, '60m');
  if (!(await parameterValuesRepository.tableExists(tableName)))
    throw new Error('Hourly measurement source is unavailable');
  const rawRows: Record<string, unknown>[] = [];
  // Complete connection history preserves the actual streak, including across year boundaries.
  const historyStart = Math.min(
    ...[...parameters.values()].map(
      (parameter) =>
        Math.ceil((Date.parse(parameter.activatedAt) + 7 * 3_600_000) / DAY_MS) * DAY_MS -
        7 * 3_600_000,
    ),
  );
  for (let start = historyStart; start <= end; start += 30 * DAY_MS) {
    const last = Math.min(start + 29 * DAY_MS, end);
    const source = await parameterValuesRepository.listRows({
      stationId: point.stationId,
      interval: '60m',
      startDate: bangkokDate(start),
      endDate: bangkokDate(last),
    });
    rawRows.push(...source.rows);
    if (rawRows.length > 100_000)
      throw new Error('Hourly history exceeds the safe preparation limit');
  }
  return [...parameters.values()].map((parameter) => {
    const parameterStart =
      Math.ceil((Date.parse(parameter.activatedAt) + 7 * 3_600_000) / DAY_MS) * DAY_MS -
      7 * 3_600_000;
    const byHour = new Map<string, AlertHourlySample[]>();
    for (const row of rawRows) {
      const measured = sourceTimestamp(row.cdate, row.ctime);
      if (
        !measured ||
        Date.parse(measured) < parameterStart ||
        Date.parse(measured) >= end + DAY_MS
      )
        continue;
      const measuredAt = `${measured.slice(0, 13)}:00:00+07:00`;
      const reportedAt = sourceTimestamp(row.udate, row.utime);
      const reading = readRegisteredAlertMeasurement(row, parameter.label);
      const sample = {
        measuredAt,
        reportedAt,
        ...reading,
        ...(measured !== measuredAt ? { sourceMeasuredAt: measured } : {}),
      };
      byHour.set(measuredAt, [...(byHour.get(measuredAt) ?? []), sample]);
    }
    const samples = [...byHour.values()]
      .map((hourSamples) => {
        const valid = hourSamples.filter(
          (sample) => sample.value !== null && Number.isFinite(sample.value),
        );
        const normal = valid.filter((sample) => sample.status === 1);
        const eligible =
          policy.completenessPolicy === 'NORMAL_EXCLUDING_SHUTDOWN' && normal.length > 0
            ? normal
            : valid;
        const choices = eligible.length > 0 ? eligible : hourSamples;
        choices.sort(
          (a, b) =>
            (a.reportedAt ? Date.parse(a.reportedAt) : Infinity) -
            (b.reportedAt ? Date.parse(b.reportedAt) : Infinity),
        );
        const selected = { ...choices[0] };
        if (
          policy.completenessPolicy === 'NORMAL_EXCLUDING_SHUTDOWN' &&
          hourSamples.some((sample) => sample.status === 6)
        )
          selected.status = 6;
        if (
          valid.some(
            (sample) => sample.value !== selected.value || sample.status !== selected.status,
          )
        )
          selected.abnormalEligible = false;
        return selected;
      })
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    const samplesByDate = new Map<string, AlertHourlySample[]>();
    for (const sample of samples) {
      const sampleDate = sample.measuredAt.slice(0, 10);
      samplesByDate.set(sampleDate, [...(samplesByDate.get(sampleDate) ?? []), sample]);
    }
    const dailySummaries = [];
    for (let at = parameterStart; at <= end; at += DAY_MS) {
      const day = bangkokDate(at);
      dailySummaries.push(
        summarizeAlertDay(day, samplesByDate.get(day) ?? [], policy.completenessPolicy),
      );
    }
    return {
      code: parameter.code,
      name: parameter.name,
      unit: parameter.unit,
      activatedAt: parameter.activatedAt,
      activationVerified: true,
      samples,
      dailySummaries,
    };
  });
}

function bangkokDate(at: number): string {
  return new Date(at + 7 * 3_600_000).toISOString().slice(0, 10);
}

function sourceTimestamp(date: unknown, time: unknown): string | null {
  if (typeof date !== 'string' || typeof time !== 'string') return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;
  const value = `${date}T${match[1].padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}+07:00`;
  return isoTimestamp.safeParse(value).success ? value : null;
}
