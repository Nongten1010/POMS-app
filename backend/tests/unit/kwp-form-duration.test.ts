import { describe, expect, it } from '@jest/globals';
import {
  deriveKwpFormDuration,
  isKwpFormDateRangeOrdered,
  parseKwpFormDateTime,
  toKwpFormDateOnly,
} from '../../src/modules/kwp-form-submissions/kwp-form-duration';

describe('KWP form duration', () => {
  it('derives exact hours while preserving the legacy inclusive day count', () => {
    expect(deriveKwpFormDuration('2026-07-01T08:00:00', '2026-07-05T06:00:00')).toEqual({
      totalDays: 5,
      totalHours: 94,
    });
  });

  it('keeps date-only submissions compatible without inventing an hourly duration', () => {
    expect(deriveKwpFormDuration('2026-07-01', '2026-07-05')).toEqual({
      totalDays: 5,
      totalHours: null,
    });
  });

  it('does not derive hours from mixed date precision or an incomplete range', () => {
    expect(deriveKwpFormDuration('2026-07-01', '2026-07-05T06:00:00')).toEqual({
      totalDays: 5,
      totalHours: null,
    });
    expect(deriveKwpFormDuration('2026-07-01T08:00:00', null)).toEqual({
      totalDays: null,
      totalHours: null,
    });
  });

  it('rejects impossible dates, non-hour precision, and reversed ranges', () => {
    expect(parseKwpFormDateTime('2026-02-30T08:00:00')).toBeNull();
    expect(parseKwpFormDateTime('2026-07-01T08:30:00')).toBeNull();
    expect(isKwpFormDateRangeOrdered('2026-07-01T09:00:00', '2026-07-01T08:00:00')).toBe(false);
    expect(deriveKwpFormDuration('2026-07-01T09:00:00', '2026-07-01T08:00:00')).toEqual({
      totalDays: null,
      totalHours: null,
    });
  });

  it('extracts the legacy date column value from either accepted precision', () => {
    expect(toKwpFormDateOnly('2026-07-01T08:00:00')).toBe('2026-07-01');
    expect(toKwpFormDateOnly('2026-07-01')).toBe('2026-07-01');
    expect(toKwpFormDateOnly(null)).toBeNull();
  });
});
