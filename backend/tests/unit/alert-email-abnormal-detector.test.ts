import { describe, expect, it } from '@jest/globals';
import {
  buildHourlyAbnormalAlertCandidates,
  type BuildHourlyAbnormalAlertCandidatesInput,
} from '../../src/modules/alert-emails/alert-email-abnormal-detector';
import type { AlertHourlySample } from '../../src/modules/alert-emails/alert-email-rules';

const HOUR_MS = 3_600_000;
const date = '2026-10-04';

function samples(count: number, start = `${date}T08:00:00+07:00`, value = 0): AlertHourlySample[] {
  return Array.from({ length: count }, (_, index) => ({
    measuredAt: new Date(Date.parse(start) + index * HOUR_MS).toISOString(),
    reportedAt: null,
    value,
    status: 'Normal',
  }));
}

function input(readings = samples(6)): BuildHourlyAbnormalAlertCandidatesInput {
  return {
    point: {
      id: 55,
      systemType: 'CEMS',
      stationId: 'S0001',
      pointCode: 'S0001',
      pointName: 'ปล่อง 1',
      pointType: 'STACK',
      factoryId: 'factory-001',
      factoryName: 'โรงงานตัวอย่าง',
      factoryRegistrationNo: '3-001',
      connectedAt: '2026-10-01T00:00:00+07:00',
      officerEmails: [],
      factoryEmails: [],
    },
    parameters: [
      {
        code: 'co',
        name: 'CO',
        unit: 'ppm',
        activatedAt: '2026-10-01T00:00:00+07:00',
        activationVerified: true,
        samples: readings,
        dailySummaries: [],
      },
    ],
    detectedAt: `${date}T13:00:00+07:00`,
  };
}

describe('hourly abnormal detection with one daily parameter and point identity', () => {
  it.each([
    ['ZERO', 0],
    ['NEGATIVE', -1],
    ['CONSTANT', 12],
  ])('confirms %s at five elapsed hours, never at only five readings', (abnormalType, value) => {
    expect(buildHourlyAbnormalAlertCandidates(input(samples(5, undefined, value)))).toEqual([]);
    const [candidate] = buildHourlyAbnormalAlertCandidates(input(samples(6, undefined, value)));
    expect(candidate).toMatchObject({
      alert_type: 'ABNORMAL_VALUE',
      abnormal_type: abnormalType,
      event_date: date,
      abnormal_streak_count: 6,
      first_abnormal_at: samples(1)[0].measuredAt,
      confirmed_abnormal_at: samples(6)[5].measuredAt,
      parameter_label: 'CO (ppm)',
    });
    expect(JSON.parse(candidate.evidence_json ?? '{}')).toMatchObject({
      abnormalMode: 'HOURLY',
      abnormalHours: 5,
      abnormalReadings: 6,
      notificationDate: date,
      elapsedMilliseconds: 5 * HOUR_MS,
    });
  });

  it('uses actual source minute offsets so six readings under five hours cannot confirm early', () => {
    const readings = samples(7).map((sample, index) => ({
      ...sample,
      sourceMeasuredAt: `${date}T${String(8 + index).padStart(2, '0')}:${index === 0 ? '32' : '15'}:00+07:00`,
    }));
    const value = input(readings.slice(0, 6));
    value.detectedAt = `${date}T13:32:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(value)).toEqual([]);
    value.parameters[0].samples = readings;
    value.detectedAt = `${date}T14:15:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(value)[0].confirmed_abnormal_at).toBe(
      `${date}T14:15:00+07:00`,
    );
  });

  it.each(['status', 'null', 'conflict', 'gap', 'changed value'])(
    'resets the five-hour sequence at %s',
    (condition) => {
      const readings = samples(6, undefined, 12);
      if (condition === 'status') readings[2].status = 'Maintenance';
      if (condition === 'null') readings[2].value = null;
      if (condition === 'conflict') readings[2].abnormalEligible = false;
      if (condition === 'gap') readings.splice(2, 1);
      if (condition === 'changed value') readings[2].value = 12.000001;
      expect(buildHourlyAbnormalAlertCandidates(input(readings))).toEqual([]);
    },
  );

  it('allows unequal negative values but does not combine zero and negative sequences', () => {
    const negative = samples(6).map((sample, index) => ({ ...sample, value: -index - 1 }));
    expect(buildHourlyAbnormalAlertCandidates(input(negative))[0].abnormal_type).toBe('NEGATIVE');
    const mixed = samples(6).map((sample, index) => ({ ...sample, value: index < 3 ? 0 : -1 }));
    expect(buildHourlyAbnormalAlertCandidates(input(mixed))).toEqual([]);
  });

  it('does not revive an episode after recovery, invalid latest status, or a stale missing hour', () => {
    const recovered = input(samples(7));
    recovered.detectedAt = `${date}T14:00:00+07:00`;
    recovered.parameters[0].samples[6].value = 12;
    expect(buildHourlyAbnormalAlertCandidates(recovered)).toEqual([]);
    recovered.parameters[0].samples[6].status = 'Shut Down';
    expect(buildHourlyAbnormalAlertCandidates(recovered)).toEqual([]);
    const stale = input();
    stale.detectedAt = `${date}T15:00:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(stale)).toEqual([]);
  });

  it('accepts the preceding hour when its hourly aggregate arrives after the hour closes', () => {
    const value = input();
    value.detectedAt = `${date}T14:01:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(value)).toHaveLength(1);
  });
  it('keeps a qualifying preceding-hour sequence with source drift in the bounded eight-hour scan', () => {
    const readings = samples(7, `${date}T06:00:00+07:00`).map((sample, index) => ({
      ...sample,
      sourceMeasuredAt: `${date}T${String(6 + index).padStart(2, '0')}:${index === 6 ? '00' : '59'}:00+07:00`,
    }));
    const value = input(readings);
    value.detectedAt = `${date}T13:59:59+07:00`;
    value.parameters[0].samples = readings.filter(
      (sample) => Date.parse(sample.sourceMeasuredAt) >= Date.parse(value.detectedAt) - 8 * HOUR_MS,
    );
    expect(buildHourlyAbnormalAlertCandidates(value)).toHaveLength(1);
  });

  it('renews a continuing streak after midnight only after a new sample in the Bangkok day', () => {
    const readings = samples(7, '2026-10-03T18:00:00+07:00');
    const previous = input(readings.slice(0, 6));
    previous.detectedAt = '2026-10-03T23:00:00+07:00';
    const [yesterday] = buildHourlyAbnormalAlertCandidates(previous);
    const current = input(readings);
    current.detectedAt = `${date}T00:00:00+07:00`;
    const [today] = buildHourlyAbnormalAlertCandidates(current);
    expect(today).toMatchObject({
      event_date: date,
      first_abnormal_at: yesterday.first_abnormal_at,
      confirmed_abnormal_at: yesterday.confirmed_abnormal_at,
    });
    expect(today.idempotency_key).not.toBe(yesterday.idempotency_key);
    expect(JSON.parse(today.evidence_json ?? '{}').triggeredAt).toBe(readings[6].measuredAt);
    current.parameters[0].samples = readings.slice(0, 6);
    expect(buildHourlyAbnormalAlertCandidates(current)).toEqual([]);
  });

  it('keeps the same daily key across changed types, episodes, activation, and live row replacement', () => {
    const [first] = buildHourlyAbnormalAlertCandidates(input());
    const another = input(samples(6, `${date}T14:00:00+07:00`, -1));
    another.detectedAt = `${date}T19:00:00+07:00`;
    another.point.id = 99;
    another.point.stationId = ' s0001 ';
    another.parameters[0].code = 'CO';
    another.parameters[0].unit = 'PPM';
    another.parameters[0].activatedAt = `${date}T14:00:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(another)[0].idempotency_key).toBe(
      first.idempotency_key,
    );
  });

  it('separates parameters, units, points, factories, and systems in the daily key', () => {
    const [first] = buildHourlyAbnormalAlertCandidates(input());
    for (const field of ['parameter', 'unit', 'point', 'factory', 'system']) {
      const another = input();
      if (field === 'parameter') another.parameters[0].code = 'cod';
      if (field === 'unit') another.parameters[0].unit = '%';
      if (field === 'point') another.point.stationId = 'S0002';
      if (field === 'factory') another.point.factoryId = 'factory-002';
      if (field === 'system') another.point.systemType = 'WPMS';
      expect(buildHourlyAbnormalAlertCandidates(another)[0].idempotency_key).not.toBe(
        first.idempotency_key,
      );
    }
  });

  it('includes the partial activation day while excluding pre-activation and future readings', () => {
    const value = input();
    value.point.connectedAt = `${date}T08:00:00+07:00`;
    value.parameters[0].activatedAt = `${date}T08:00:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(value)).toHaveLength(1);
    value.parameters[0].activatedAt = `${date}T09:00:00+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(value)).toEqual([]);
    const future = input();
    future.detectedAt = `${date}T12:59:59+07:00`;
    expect(buildHourlyAbnormalAlertCandidates(future)).toEqual([]);
  });
});
