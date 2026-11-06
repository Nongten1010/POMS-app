const HOUR_MS = 3_600_000;

/** All device protocols may report an hourly bucket until the following hour ends. */
export function hourlyMeasurementReceiptStatus(
  measuredAt: number,
  reportedAt: number,
): 'onTime' | 'late' | 'unknown' {
  if (!Number.isFinite(measuredAt) || !Number.isFinite(reportedAt)) return 'unknown';

  const hourStart = Math.floor(measuredAt / HOUR_MS) * HOUR_MS;
  return reportedAt < hourStart + 2 * HOUR_MS ? 'onTime' : 'late';
}
