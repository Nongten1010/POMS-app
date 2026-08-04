const CANONICAL_STATUS_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const LEGACY_LOCAL_STATUS_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;
const LEGACY_OFFSET_STATUS_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const BANGKOK_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1000;

export const STATUS_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function normalizeStatusDateTimeInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (isCanonicalStatusDateTime(trimmed)) return trimmed;

  const localMatch = LEGACY_LOCAL_STATUS_DATETIME_PATTERN.exec(trimmed);
  if (localMatch) {
    const [, year, month, day, hour, minute, second = '00'] = localMatch;
    const normalized = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    return isCanonicalStatusDateTime(normalized) ? normalized : value;
  }

  const offsetMatch = LEGACY_OFFSET_STATUS_DATETIME_PATTERN.exec(trimmed);
  if (!offsetMatch || !hasValidDateTimeParts(offsetMatch)) return value;

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return value;

  return new Date(timestamp + BANGKOK_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export function toCanonicalStatusDateTime(value: unknown): string | null {
  const normalized = normalizeStatusDateTimeInput(value);
  return typeof normalized === 'string' && isCanonicalStatusDateTime(normalized)
    ? normalized
    : null;
}

export function isCanonicalStatusDateTime(value: string): boolean {
  const match = CANONICAL_STATUS_DATETIME_PATTERN.exec(value);
  return match !== null && hasValidDateTimeParts(match);
}

function hasValidDateTimeParts(match: RegExpExecArray): boolean {
  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second)
  );
}
