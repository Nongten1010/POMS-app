const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00:00$/;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

interface ParsedKwpFormDateTime {
  dateOnly: string;
  hasHour: boolean;
  timestamp: number;
}

export interface KwpFormDuration {
  totalDays: number | null;
  totalHours: number | null;
}

export function parseKwpFormDateTime(value: string): ParsedKwpFormDateTime | null {
  const match = HOUR_DATETIME_PATTERN.exec(value) ?? DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  if (hour < 0 || hour > 23) return null;

  const timestamp = Date.UTC(year, month - 1, day, hour);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour
  ) {
    return null;
  }

  return {
    dateOnly: `${yearText}-${monthText}-${dayText}`,
    hasHour: hourText !== undefined,
    timestamp,
  };
}

export function deriveKwpFormDuration(
  problemDate?: string | null,
  expectedDoneDate?: string | null,
): KwpFormDuration {
  if (!problemDate || !expectedDoneDate) {
    return { totalDays: null, totalHours: null };
  }

  const start = parseKwpFormDateTime(problemDate);
  const end = parseKwpFormDateTime(expectedDoneDate);
  if (!start || !end || end.timestamp < start.timestamp) {
    return { totalDays: null, totalHours: null };
  }

  const startDay = Date.parse(`${start.dateOnly}T00:00:00Z`);
  const endDay = Date.parse(`${end.dateOnly}T00:00:00Z`);

  return {
    totalDays: Math.floor((endDay - startDay) / MILLISECONDS_PER_DAY) + 1,
    totalHours:
      start.hasHour && end.hasHour
        ? Math.floor((end.timestamp - start.timestamp) / MILLISECONDS_PER_HOUR)
        : null,
  };
}

export function isKwpFormDateRangeOrdered(
  problemDate?: string | null,
  expectedDoneDate?: string | null,
): boolean {
  if (!problemDate || !expectedDoneDate) return true;
  const start = parseKwpFormDateTime(problemDate);
  const end = parseKwpFormDateTime(expectedDoneDate);
  return Boolean(start && end && end.timestamp >= start.timestamp);
}

export function isHourlyKwpFormDateTime(value?: string | null): boolean {
  return Boolean(value && HOUR_DATETIME_PATTERN.test(value));
}

export function toKwpFormDateOnly(value?: string | null): string | null {
  return value ? (parseKwpFormDateTime(value)?.dateOnly ?? null) : null;
}
