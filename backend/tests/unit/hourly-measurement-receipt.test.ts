import { describe, expect, it } from '@jest/globals';
import { hourlyMeasurementReceiptStatus } from '../../src/shared/utils/hourly-measurement-receipt';

describe('hourly measurement receipt deadline', () => {
  it('uses the measurement hour rather than extending the deadline from its minutes', () => {
    const measured = Date.parse('2026-11-06T09:32:15+07:00');
    expect(
      hourlyMeasurementReceiptStatus(measured, Date.parse('2026-11-06T10:59:59.999+07:00')),
    ).toBe('onTime');
    expect(hourlyMeasurementReceiptStatus(measured, Date.parse('2026-11-06T11:00:00+07:00'))).toBe(
      'late',
    );
  });

  it.each([
    [NaN, 0],
    [0, NaN],
    [Infinity, 0],
    [0, -Infinity],
  ])('returns unknown for unusable timestamps %s and %s', (measured, reported) => {
    expect(hourlyMeasurementReceiptStatus(measured, reported)).toBe('unknown');
  });
});
