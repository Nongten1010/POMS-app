import { describe, expect, it } from '@jest/globals';
import { buildDailyAlertCandidates } from '../../src/modules/alert-emails/alert-email-daily-detector';
import type {
  AlertDaySummary,
  AlertHourlySample,
} from '../../src/modules/alert-emails/alert-email-rules';

const date = '2026-10-04';
const detectedAt = '2026-10-05T02:00:00.000Z';
const point = {
  id: 55,
  systemType: 'CEMS' as const,
  stationId: 'station-1',
  pointCode: 'S01',
  pointName: 'Stack 1',
  pointType: 'STACK' as const,
  factoryId: 'factory-1',
  factoryName: 'บริษัท ตัวอย่าง จำกัด',
  factoryRegistrationNo: '3-001',
  connectedAt: '2026-09-01T00:00:00+07:00',
  officerEmails: [],
  factoryEmails: [],
};

function samples(count: number, day = date): AlertHourlySample[] {
  const start = Date.parse(`${day}T00:00:00+07:00`);
  return Array.from({ length: count }, (_, hour) => ({
    measuredAt: new Date(start + hour * 3_600_000).toISOString(),
    reportedAt: new Date(start + hour * 3_600_000 + 60_000).toISOString(),
    value: hour + 1,
    status: 'Normal',
  }));
}

function previousDays(count: number): AlertDaySummary[] {
  return Array.from({ length: count }, (_, daysAgo) => ({
    date: new Date(Date.parse(`${date}T00:00:00Z`) - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10),
    expectedCount: 24,
    receivedCount: daysAgo % 2 === 0 ? 0 : 19,
    completenessPercent: daysAgo % 2 === 0 ? 0 : 79.17,
    lowCompleteness: true,
  }));
}

function input(overrides: Partial<Parameters<typeof buildDailyAlertCandidates>[0]> = {}) {
  return {
    point,
    parameters: [
      { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: samples(19), dailySummaries: [] },
    ],
    date,
    detectedAt,
    completenessPolicy: 'ON_TIME' as const,
    exemptDayPolicy: 'RESET' as const,
    abnormalReadings: 5,
    ...overrides,
  };
}

describe('buildDailyAlertCandidates', () => {
  it('builds a low-completeness event using trusted point identity, actual counts and full Bangkok day boundaries', () => {
    const candidates = buildDailyAlertCandidates(input());

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      alert_type: 'DAILY_COMPLETENESS_LOW',
      system_type: 'CEMS',
      display_system_type: 'CEMS',
      connected_measurement_point_id: 55,
      factory_id: 'factory-1',
      factory_name: 'บริษัท ตัวอย่าง จำกัด',
      parameter_code: 'SO2',
      parameter_label: 'SO₂ (ppm)',
      unit: 'ppm',
      event_date: date,
      started_at: '2026-10-03T17:00:00.000Z',
      ended_at: '2026-10-04T17:00:00.000Z',
      detected_at: detectedAt,
      completeness_percent: 79.17,
      threshold_value: null,
      threshold_type: null,
      notification_status: 'AUTO',
    });
    expect(JSON.parse(candidates[0].evidence_json ?? '{}')).toMatchObject({
      completenessPolicy: 'ON_TIME',
      exemptDayPolicy: 'RESET',
      expectedCount: 24,
      receivedCount: 19,
    });
    expect(candidates[0].source_payload_json).toBeNull();
  });

  it('does not create a daily alert when current readings are complete even if cached current summary says low', () => {
    const candidates = buildDailyAlertCandidates(
      input({
        parameters: [
          {
            code: 'SO2',
            name: 'SO₂',
            unit: 'ppm',
            samples: samples(24),
            dailySummaries: previousDays(15),
          },
        ],
      }),
    );
    expect(candidates).toEqual([]);
  });

  it('counts both missing and below-80-percent days and reaches CEMS threshold on day 15, not day 14', () => {
    for (const count of [14, 15]) {
      const candidates = buildDailyAlertCandidates(
        input({
          parameters: [
            {
              code: 'SO2',
              name: 'SO₂',
              unit: 'ppm',
              samples: [],
              dailySummaries: previousDays(count),
            },
          ],
        }),
      );
      const consecutive = candidates.filter(
        (candidate) => candidate.alert_type === 'CONSECUTIVE_NO_REPORT',
      );
      expect(consecutive).toHaveLength(count === 15 ? 1 : 0);
      if (count === 15) {
        expect(consecutive[0].consecutive_days).toBe(15);
        expect(JSON.parse(consecutive[0].evidence_json ?? '{}')).toMatchObject({
          startedOn: '2026-09-20',
          endedOn: date,
        });
      }
    }
  });

  it('reaches WPMS threshold on day 8, not day 7 and identifies BOD/COD Online', () => {
    for (const count of [7, 8]) {
      const candidates = buildDailyAlertCandidates(
        input({
          point: { ...point, systemType: 'WPMS', pointType: 'WASTEWATER' },
          parameters: [
            {
              code: 'BOD',
              name: 'BOD',
              unit: 'mg/l',
              samples: [],
              dailySummaries: previousDays(count),
            },
          ],
        }),
      );
      const consecutive = candidates.filter(
        (candidate) => candidate.alert_type === 'CONSECUTIVE_NO_REPORT',
      );
      expect(consecutive).toHaveLength(count === 8 ? 1 : 0);
      if (count === 8)
        expect(consecutive[0]).toMatchObject({
          consecutive_days: 8,
          display_system_type: 'BOD_COD_ONLINE',
        });
    }
  });

  it('resets the sequence when a historical day reaches 80 percent', () => {
    const history = previousDays(20);
    history[6] = { ...history[6], completenessPercent: 80, lowCompleteness: false };
    const candidates = buildDailyAlertCandidates(
      input({
        parameters: [
          { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: [], dailySummaries: history },
        ],
      }),
    );
    expect(candidates.map((candidate) => candidate.alert_type)).toEqual(['DAILY_COMPLETENESS_LOW']);
  });

  it('does not treat exactly 80 percent under the shutdown-excluding policy as low', () => {
    const readings = samples(24).map((sample, hour) => ({
      ...sample,
      status: hour >= 5 ? 'Shut Down' : 'Normal',
      value: hour === 4 ? null : sample.value,
    }));
    expect(
      buildDailyAlertCandidates(
        input({
          completenessPolicy: 'NORMAL_EXCLUDING_SHUTDOWN',
          parameters: [
            { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: readings, dailySummaries: [] },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('honors explicit pause or reset policy for a full shutdown day within the sequence', () => {
    const history = previousDays(16);
    history[4] = {
      ...history[4],
      expectedCount: 0,
      receivedCount: 0,
      completenessPercent: null,
      lowCompleteness: null,
    };
    const common = input({
      parameters: [{ code: 'SO2', name: 'SO₂', unit: 'ppm', samples: [], dailySummaries: history }],
    });
    expect(
      buildDailyAlertCandidates({ ...common, exemptDayPolicy: 'RESET' }).some(
        (candidate) => candidate.alert_type === 'CONSECUTIVE_NO_REPORT',
      ),
    ).toBe(false);
    expect(
      buildDailyAlertCandidates({ ...common, exemptDayPolicy: 'PAUSE' }).find(
        (candidate) => candidate.alert_type === 'CONSECUTIVE_NO_REPORT',
      )?.consecutive_days,
    ).toBe(15);
  });

  it('sends no consecutive alert on an exempt reporting day while a pause preserves the preceding streak', () => {
    const readings = samples(24).map((sample) => ({ ...sample, status: 'Shut Down' }));
    const candidates = buildDailyAlertCandidates(
      input({
        completenessPolicy: 'NORMAL_EXCLUDING_SHUTDOWN',
        exemptDayPolicy: 'PAUSE',
        parameters: [
          {
            code: 'SO2',
            name: 'SO₂',
            unit: 'ppm',
            samples: readings,
            dailySummaries: previousDays(16),
          },
        ],
      }),
    );
    expect(candidates).toEqual([]);
  });

  it.each([
    ['CONSTANT', 12],
    ['ZERO', 0],
    ['NEGATIVE', -1],
  ])(
    'detects %s only after the configured Normal hourly readings and preserves the actual window',
    (abnormalType, value) => {
      const readings = samples(5).map((sample) => ({ ...sample, value }));
      const candidates = buildDailyAlertCandidates(
        input({
          parameters: [
            { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: readings, dailySummaries: [] },
          ],
        }),
      );
      const abnormal = candidates.find((candidate) => candidate.alert_type === 'ABNORMAL_VALUE');
      expect(abnormal).toMatchObject({
        abnormal_type: abnormalType,
        abnormal_streak_count: 5,
        measured_value: value,
        first_abnormal_at: readings[0].measuredAt,
        confirmed_abnormal_at: readings[4].measuredAt,
        started_at: readings[0].measuredAt,
        ended_at: readings[4].measuredAt,
        threshold_type: null,
        threshold_value: null,
      });
    },
  );

  it('includes episodes begun before the reporting day and cuts off future readings at the reporting day end', () => {
    const dayStart = Date.parse(`${date}T00:00:00+07:00`);
    const readings = Array.from({ length: 28 }, (_, hour) => ({
      measuredAt: new Date(dayStart + (hour - 2) * 3_600_000).toISOString(),
      reportedAt: null,
      value: 0,
      status: 'Normal',
    }));
    const abnormal = buildDailyAlertCandidates(
      input({
        parameters: [
          { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: readings, dailySummaries: [] },
        ],
      }),
    ).find((candidate) => candidate.alert_type === 'ABNORMAL_VALUE');
    expect(abnormal).toMatchObject({
      first_abnormal_at: readings[0].measuredAt,
      abnormal_streak_count: 26,
      ended_at: readings[25].measuredAt,
    });
  });

  it('does not alert for episodes ending before the day, fewer readings, gaps, or non-Normal statuses', () => {
    const prior = samples(5, '2026-10-03').map((sample) => ({ ...sample, value: 0 }));
    const readings = samples(5).map((sample, index) => ({
      ...sample,
      value: 0,
      status: index === 2 ? 'Calibration' : 'Normal',
    }));
    const withGap = samples(6)
      .filter((_, index) => index !== 2)
      .map((sample) => ({ ...sample, value: 0 }));
    for (const set of [
      prior,
      readings,
      withGap,
      samples(4).map((sample) => ({ ...sample, value: 0 })),
    ]) {
      const candidates = buildDailyAlertCandidates(
        input({
          parameters: [{ code: 'SO2', name: 'SO₂', unit: 'ppm', samples: set, dailySummaries: [] }],
        }),
      );
      expect(candidates.some((candidate) => candidate.alert_type === 'ABNORMAL_VALUE')).toBe(false);
    }
  });

  it('keeps separate episode and unit identities stable and changes daily recurrence and policy keys', () => {
    const readings = samples(11).map((sample, index) => ({
      ...sample,
      value: index < 5 ? 0 : index === 5 ? 20 : -1,
    }));
    const common = input({
      parameters: [
        { code: 'CO', name: 'CO', unit: 'ppm', samples: readings, dailySummaries: [] },
        { code: 'CO', name: 'CO', unit: '%', samples: [], dailySummaries: [] },
      ],
    });
    const candidates = buildDailyAlertCandidates(common);
    expect(new Set(candidates.map((candidate) => candidate.idempotency_key)).size).toBe(
      candidates.length,
    );
    expect(buildDailyAlertCandidates(common)).toEqual(candidates);
    expect(
      buildDailyAlertCandidates({ ...common, parameters: [...common.parameters].reverse() }),
    ).toEqual(candidates);
    expect(
      candidates.filter((candidate) => candidate.alert_type === 'ABNORMAL_VALUE'),
    ).toHaveLength(2);
    const alternate = buildDailyAlertCandidates({
      ...common,
      completenessPolicy: 'NORMAL_EXCLUDING_SHUTDOWN',
    });
    expect(alternate[0].idempotency_key).not.toBe(candidates[0].idempotency_key);
  });

  it('does not count or alert before connection and skips a partial activation day', () => {
    expect(
      buildDailyAlertCandidates(
        input({ point: { ...point, connectedAt: '2026-10-04T10:00:00+07:00' } }),
      ),
    ).toEqual([]);
    const candidates = buildDailyAlertCandidates(
      input({
        point: { ...point, connectedAt: '2026-09-25T10:00:00+07:00' },
        parameters: [
          { code: 'SO2', name: 'SO₂', unit: 'ppm', samples: [], dailySummaries: previousDays(20) },
        ],
      }),
    );
    expect(candidates.some((candidate) => candidate.alert_type === 'CONSECUTIVE_NO_REPORT')).toBe(
      false,
    );
  });

  it('does not count pre-registration days for a parameter activated on the reporting day', () => {
    const parameter = {
      code: 'SO2',
      name: 'SO₂',
      unit: 'ppm',
      samples: [],
      dailySummaries: previousDays(20),
      activatedAt: '2026-10-04T00:00:00+07:00',
    };
    const candidates = buildDailyAlertCandidates(input({ parameters: [parameter] }));
    expect(candidates.map((candidate) => candidate.alert_type)).toEqual(['DAILY_COMPLETENESS_LOW']);
    const partialDayParameter = { ...parameter, activatedAt: '2026-10-04T10:00:00+07:00' };
    expect(buildDailyAlertCandidates(input({ parameters: [partialDayParameter] }))).toEqual([]);
  });

  it('fails closed for missing activation history, unregistered units, ambiguous time or incomplete day', () => {
    expect(buildDailyAlertCandidates(input({ point: { ...point, connectedAt: null } }))).toEqual(
      [],
    );
    expect(() =>
      buildDailyAlertCandidates(
        input({
          parameters: [{ code: 'SO2', name: 'SO₂', unit: '', samples: [], dailySummaries: [] }],
        }),
      ),
    ).toThrow('unit');
    expect(() => buildDailyAlertCandidates(input({ detectedAt: '2026-10-05T09:00:00' }))).toThrow(
      'timezone',
    );
    expect(() =>
      buildDailyAlertCandidates(input({ detectedAt: '2026-10-04T09:00:00+07:00' })),
    ).toThrow('completed');
  });
});
