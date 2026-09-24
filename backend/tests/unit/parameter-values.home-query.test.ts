import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  calendarStatusDetailsQuerySchema,
  calendarStatusQuerySchema,
} from '../../src/modules/parameter-values/parameter-values.validator';

describe('home calendar selected end date', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T17:30:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts the selected Bangkok day and preserves existing queries', () => {
    expect(calendarStatusQuerySchema.parse({ month: '2026-09', endDate: '2026-09-23' })).toEqual({
      month: '2026-09',
      endDate: '2026-09-23',
    });
    expect(calendarStatusQuerySchema.parse({ month: '2026-12' })).toEqual({ month: '2026-12' });
    expect(
      calendarStatusDetailsQuerySchema.parse({
        year: '2026',
        summaryType: 'lowData',
        parameterCode: 'CO',
        unit: 'ppm',
        endDate: '2026-09-23',
      }),
    ).toMatchObject({ endDate: '2026-09-23' });
  });

  it.each(['2026-08-31', '2026-09-24', '2026-09-31', 'not-a-date', '2026-99-99'])(
    'rejects invalid calendar anchor %s',
    (endDate) => {
      expect(calendarStatusQuerySchema.safeParse({ month: '2026-09', endDate }).success).toBe(
        false,
      );
    },
  );

  it.each(['2025-12-31', '2026-09-24', '2026-02-30'])(
    'rejects invalid details anchor %s',
    (endDate) => {
      expect(
        calendarStatusDetailsQuerySchema.safeParse({
          year: '2026',
          summaryType: 'exceeded',
          parameterCode: 'CO',
          endDate,
        }).success,
      ).toBe(false);
    },
  );
});
