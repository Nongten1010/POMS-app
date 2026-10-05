import { describe, expect, it } from '@jest/globals';
import {
  summarizeAlertDay,
  countConsecutiveLowReportingDays,
  detectAbnormalHourlyEpisodes,
  latestAlertEmailPeriods,
  type AlertHourlySample,
} from '../../src/modules/alert-emails/alert-email-rules';

function sample(hour: number, overrides: Partial<AlertHourlySample> = {}): AlertHourlySample {
  return {
    measuredAt: `2026-10-01T${String(hour).padStart(2, '0')}:00:00+07:00`,
    reportedAt: `2026-10-01T${String(hour).padStart(2, '0')}:30:00+07:00`,
    value: 10,
    status: 'Normal',
    ...overrides,
  };
}

describe('alert email daily and hourly rules', () => {
  it('matches the existing home on-time classification for an earlier receipt bucket', () => {
    expect(
      summarizeAlertDay(
        '2026-10-01',
        [sample(10, { reportedAt: '2026-10-01T09:59:00+07:00' })],
        'ON_TIME',
      ).receivedCount,
    ).toBe(1);
  });
  it('rejects impossible summary dates', () => {
    expect(() => summarizeAlertDay('2026-02-30', [], 'ON_TIME')).toThrow();
  });
  it('counts distinct on-time hours, not duplicate rows or late backfills', () => {
    const rows = Array.from({ length: 19 }, (_, hour) => sample(hour));
    rows.push(sample(0), sample(19, { reportedAt: '2026-10-02T08:00:00+07:00' }));
    const result = summarizeAlertDay('2026-10-01', rows, 'ON_TIME');
    expect(result).toMatchObject({ expectedCount: 24, receivedCount: 19, lowCompleteness: true });
    expect(result.completenessPercent).toBeCloseTo(79.17);
  });

  it('uses exact counts for the 80 percent boundary before rounding', () => {
    const rows = Array.from({ length: 20 }, (_, hour) => sample(hour));
    expect(summarizeAlertDay('2026-10-01', rows, 'ON_TIME').lowCompleteness).toBe(false);
  });

  it('supports an explicitly selected Normal / non-shutdown-hours policy', () => {
    const rows = Array.from({ length: 24 }, (_, hour) =>
      sample(hour, {
        status: hour < 4 ? 'Shut Down' : hour < 20 ? 'Normal' : 'Maintenance',
      }),
    );
    expect(summarizeAlertDay('2026-10-01', rows, 'NORMAL_EXCLUDING_SHUTDOWN')).toMatchObject({
      expectedCount: 20,
      receivedCount: 16,
      completenessPercent: 80,
      lowCompleteness: false,
    });
  });

  it('marks a full shutdown day as exempt, never as zero percent reporting', () => {
    const rows = Array.from({ length: 24 }, (_, hour) => sample(hour, { status: 6 }));
    expect(summarizeAlertDay('2026-10-01', rows, 'NORMAL_EXCLUDING_SHUTDOWN')).toMatchObject({
      expectedCount: 0,
      completenessPercent: null,
      lowCompleteness: null,
    });
  });

  it('does not count wrong-day, missing-value, invalid-time or unknown receipt rows', () => {
    const result = summarizeAlertDay(
      '2026-10-01',
      [
        sample(0, { value: null }),
        sample(1, { reportedAt: null }),
        sample(2, { measuredAt: '2026-10-02T02:00:00+07:00' }),
        sample(3, { measuredAt: 'invalid' }),
      ],
      'ON_TIME',
    );
    expect(result.receivedCount).toBe(0);
  });

  it('combines no-report and low-completeness days across month and year boundaries', () => {
    const days = [
      { date: '2025-12-30', lowCompleteness: false },
      { date: '2025-12-31', lowCompleteness: true },
      { date: '2026-01-01', lowCompleteness: true },
      { date: '2026-01-02', lowCompleteness: true },
    ];
    expect(countConsecutiveLowReportingDays(days, '2026-01-02', 'RESET')).toEqual({
      count: 3,
      startedOn: '2025-12-31',
      endedOn: '2026-01-02',
    });
  });

  it('stops at a missing summary instead of inventing missing reporting data', () => {
    expect(
      countConsecutiveLowReportingDays(
        [
          { date: '2026-10-01', lowCompleteness: true },
          { date: '2026-10-03', lowCompleteness: true },
        ],
        '2026-10-03',
        'RESET',
      ).count,
    ).toBe(1);
  });

  it('requires an explicit reset or pause policy for exempt days', () => {
    const days = [
      { date: '2026-10-01', lowCompleteness: true },
      { date: '2026-10-02', lowCompleteness: null },
      { date: '2026-10-03', lowCompleteness: true },
    ];
    expect(countConsecutiveLowReportingDays(days, '2026-10-03', 'RESET').count).toBe(1);
    expect(countConsecutiveLowReportingDays(days, '2026-10-03', 'PAUSE').count).toBe(2);
  });

  it('confirms five hourly zero readings once, with ZERO taking precedence over CONSTANT', () => {
    const episodes = detectAbnormalHourlyEpisodes(
      Array.from({ length: 6 }, (_, hour) => sample(hour, { value: 0 })),
      5,
    );
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ abnormalType: 'ZERO', streakCount: 6 });
    expect(episodes[0].confirmedAt).toBe(sample(4).measuredAt);
    expect(episodes[0].startedAt).toBe(sample(0).measuredAt);
  });
  it('preserves actual source times and excludes conflicted duplicates from abnormal detection', () => {
    const rows = Array.from({ length: 5 }, (_, hour) =>
      sample(hour, { sourceMeasuredAt: `2026-10-01T0${hour}:32:00+07:00` }),
    );
    expect(detectAbnormalHourlyEpisodes(rows, 5)[0].confirmedAt).toBe('2026-10-01T04:32:00+07:00');
    rows[2].abnormalEligible = false;
    expect(detectAbnormalHourlyEpisodes(rows, 5)).toEqual([]);
  });

  it('detects negative readings independently of their numeric equality', () => {
    expect(
      detectAbnormalHourlyEpisodes(
        Array.from({ length: 5 }, (_, hour) => sample(hour, { value: -hour - 1 })),
        5,
      )[0].abnormalType,
    ).toBe('NEGATIVE');
  });

  it('does not confirm four readings, duplicates, non-Normal statuses, or separated hours', () => {
    expect(
      detectAbnormalHourlyEpisodes(
        Array.from({ length: 4 }, (_, hour) => sample(hour)),
        5,
      ),
    ).toEqual([]);
    expect(
      detectAbnormalHourlyEpisodes(
        Array.from({ length: 5 }, () => sample(0)),
        5,
      ),
    ).toEqual([]);
    expect(
      detectAbnormalHourlyEpisodes(
        Array.from({ length: 5 }, (_, hour) => sample(hour, { status: 'Maintenance' })),
        5,
      ),
    ).toEqual([]);
    expect(
      detectAbnormalHourlyEpisodes([sample(0), sample(1), sample(3), sample(4), sample(5)], 5),
    ).toEqual([]);
  });

  it('resets a constant-value sequence when a different normal value arrives', () => {
    const rows = Array.from({ length: 11 }, (_, hour) =>
      sample(hour, { value: hour === 5 ? 12 : 10 }),
    );
    expect(detectAbnormalHourlyEpisodes(rows, 5)).toHaveLength(2);
  });

  it('continues an hourly sequence across midnight and rejects invalid thresholds', () => {
    const rows = [
      sample(22),
      sample(23),
      ...Array.from({ length: 3 }, (_, hour) =>
        sample(hour, {
          measuredAt: `2026-10-02T0${hour}:00:00+07:00`,
        }),
      ),
    ];
    expect(detectAbnormalHourlyEpisodes(rows, 5)).toHaveLength(1);
    expect(() => detectAbnormalHourlyEpisodes(rows, 1)).toThrow();
  });

  it('schedules 11:00 measurements after noon and daily mail at 09:00 Bangkok', () => {
    const periods = latestAlertEmailPeriods(new Date('2026-10-02T05:05:00Z'), 5);
    expect(periods.hourly).toEqual({
      startAt: '2026-10-02T04:00:00.000Z',
      endAt: '2026-10-02T05:00:00.000Z',
      scheduledAt: '2026-10-02T05:05:00.000Z',
    });
    expect(periods.daily).toEqual({
      startAt: '2026-09-30T17:00:00.000Z',
      endAt: '2026-10-01T17:00:00.000Z',
      scheduledAt: '2026-10-02T02:00:00.000Z',
    });
  });

  it('handles 23:00 measurements and the daily deadline across midnight', () => {
    const periods = latestAlertEmailPeriods(new Date('2026-10-01T17:05:00Z'), 5);
    expect(periods.hourly.startAt).toBe('2026-10-01T16:00:00.000Z');
    expect(periods.daily.scheduledAt).toBe('2026-10-01T02:00:00.000Z');
  });
});
