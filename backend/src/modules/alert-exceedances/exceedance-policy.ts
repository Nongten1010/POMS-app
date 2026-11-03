import { z } from 'zod';

const integer = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

export interface ActiveExceedancePolicy {
  mode: 'shadow' | 'active';
  stations: string[];
  cutover: Date;
  hourLabel: 'START' | 'END';
  delayMinutes: number;
  batchSize: number;
  budgetMs: number;
  timeoutMs: number;
  lateHours: number;
  recheckHours: number;
}

export type ExceedancePolicy = { mode: 'off' } | ActiveExceedancePolicy;

/** Enabling detection never enables SMTP. Active policy choices must be explicit. */
export function readExceedancePolicy(settings: NodeJS.ProcessEnv): ExceedancePolicy {
  const mode = z
    .enum(['off', 'shadow', 'active'])
    .default('off')
    .parse(settings.ALERT_EXCEEDANCE_MODE);
  if (mode === 'off') return { mode };
  const options = z
    .object({
      stations: z.string().min(1),
      cutover: z.iso.datetime({ offset: true }),
      hourLabel: z.enum(['START', 'END']),
      delayMinutes: integer(0, 59, 10),
      batchSize: integer(1, 50, 50),
      budgetMs: integer(1_000, 300_000, 300_000),
      timeoutMs: integer(1_000, 15_000, 5_000),
      lateHours: integer(1, 24, 24),
      recheckHours: integer(1, 6, 3),
    })
    .parse({
      stations: settings.ALERT_EXCEEDANCE_STATIONS,
      cutover: settings.ALERT_EXCEEDANCE_CUTOVER,
      hourLabel: settings.ALERT_EXCEEDANCE_HOUR_LABEL,
      delayMinutes: settings.ALERT_EXCEEDANCE_DELAY_MINUTES,
      batchSize: settings.ALERT_EXCEEDANCE_BATCH_SIZE,
      budgetMs: settings.ALERT_EXCEEDANCE_BUDGET_MS,
      timeoutMs: settings.ALERT_EXCEEDANCE_QUERY_TIMEOUT_MS,
      lateHours: settings.ALERT_EXCEEDANCE_LATE_HOURS,
      recheckHours: settings.ALERT_EXCEEDANCE_RECHECK_HOURS,
    });
  const stations = [...new Set(options.stations.split(',').map((value) => value.trim()))];
  if (
    stations.length > 500 ||
    stations.some((station) => !/^[A-Za-z0-9_/-]{1,64}$/.test(station))
  ) {
    throw new Error('Invalid exceedance station allowlist');
  }
  if (
    mode === 'active' &&
    (settings.ALERT_EXCEEDANCE_NORMAL_ONLY_CONFIRMED !== 'true' ||
      settings.ALERT_EXCEEDANCE_DATA_BASIS_CONFIRMED !== 'true' ||
      settings.ALERT_EXCEEDANCE_STATION_IDS_CONFIRMED !== 'true')
  )
    throw new Error('Active exceedance policy must be confirmed');
  return { ...options, stations, cutover: new Date(options.cutover), mode };
}
