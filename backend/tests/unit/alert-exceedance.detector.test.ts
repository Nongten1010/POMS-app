import { describe, expect, it } from '@jest/globals';
import { buildAlertEventIdempotencyKey } from '../../src/modules/alert-events/alert-event-identity';
import {
  evaluateExceedanceHour,
  isSourceHour,
  sourceHourLabel,
  type ExceedancePoint,
} from '../../src/modules/alert-exceedances/exceedance-detector';

const hour = new Date('2026-11-03T10:00:00+07:00');
function point(systemType: 'CEMS' | 'WPMS' = 'CEMS'): ExceedancePoint {
  return {
    id: 55,
    stationId: systemType === 'CEMS' ? 'S0001' : 'P0001',
    systemType,
    fingerprint: 'test',
    parameters: [
      { label: 'CO (ppm)', activatedAt: '2026-11-01T00:00:00Z', standard: 120, eia: 100 },
    ],
  };
}
const row = { co_value: 125, co_units: 'ppm', co_status: 'Normal' };

describe('hourly upper-limit detector', () => {
  it('skips explicitly disabled criteria even when they retain an old numeric threshold', () => {
    const target = point();
    target.parameters[0].eiaEnabled = false;
    expect(
      evaluateExceedanceHour(target, hour, [row]).events.map((event) => event.thresholdType),
    ).toEqual(['STANDARD']);
    expect(evaluateExceedanceHour(target, hour, [row]).issues).toEqual([]);
    target.parameters[0].standardEnabled = false;
    expect(evaluateExceedanceHour(target, hour, [{ co_value: null }])).toMatchObject({
      events: [],
      issues: [],
    });
  });
  it.each(['CEMS', 'WPMS'] as const)(
    'builds both threshold events for %s with existing API identities',
    (system) => {
      const result = evaluateExceedanceHour(point(system), hour, [row]);
      expect(result.issues).toEqual([]);
      expect(result.events.map((event) => event.alertType)).toEqual([
        'STANDARD_EXCEEDED',
        'EIA_EXCEEDED',
      ]);
      for (const event of result.events) {
        expect(event.idempotencyKey).toBe(buildAlertEventIdempotencyKey(event));
        expect(event.parameterLabel).toBe('CO (ppm)');
        expect(event.startedAt).toBe('2026-11-03T10:00:00+07:00');
        expect(event.sourcePayload).toMatchObject({ eventDate: '2026-11-03', time: '10:00' });
      }
    },
  );
  it.each([99, 100, 120, 120.000001])(
    'does not round value %s before comparing each threshold independently',
    (value) => {
      const result = evaluateExceedanceHour(point(), hour, [{ ...row, co_value: value }]);
      expect(result.events.map((event) => event.thresholdType)).toEqual(
        value > 120 ? ['STANDARD', 'EIA'] : value > 100 ? ['EIA'] : [],
      );
    },
  );
  it('accepts numeric strings and a real zero threshold', () => {
    const target = point();
    target.parameters[0].standard = '0';
    target.parameters[0].eia = ' 120 ';
    expect(evaluateExceedanceHour(target, hour, [{ ...row, co_value: '125' }]).events).toHaveLength(
      2,
    );
  });
  it.each([null, '', ' ', true, false, [], {}, NaN, Infinity])(
    'does not coerce invalid reading %j into a measurement',
    (value) => {
      const result = evaluateExceedanceHour(point(), hour, [{ ...row, co_value: value }]);
      expect(result.events).toHaveLength(0);
      expect(result.issues).toContain('INVALID_OR_MISSING_READING');
    },
  );
  it.each([null, '', false, [], '100-200', 'Infinity'])(
    'keeps unavailable criterion %j separate from the valid other criterion',
    (standard) => {
      const target = point();
      target.parameters[0].standard = standard;
      const result = evaluateExceedanceHour(target, hour, [row]);
      expect(result.events.map((event) => event.thresholdType)).toEqual(['EIA']);
      expect(result.issues).toContain('STANDARD_CONFIG_UNAVAILABLE');
    },
  );
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 'Calibration'])(
    'does not treat status %j as Normal',
    (status) => {
      expect(
        evaluateExceedanceHour(point(), hour, [{ ...row, co_status: status }]).events,
      ).toHaveLength(0);
    },
  );
  it('keeps missing hours pending and conflicting duplicate readings unresolved', () => {
    expect(evaluateExceedanceHour(point(), hour, []).issues).toContain('WAITING_DATA');
    const conflict = evaluateExceedanceHour(point(), hour, [row, { ...row, co_value: 200 }]);
    expect(conflict.events).toHaveLength(0);
    expect(conflict.issues).toContain('CONFLICTING_READINGS');
    expect(evaluateExceedanceHour(point(), hour, [row, { ...row }]).events).toHaveLength(2);
  });
  it('requires source units and does not merge competing physical unit families', () => {
    const target = point();
    target.parameters.push({ ...target.parameters[0], label: 'CO (%)', standard: 1, eia: 2 });
    const result = evaluateExceedanceHour(target, hour, [
      { ...row, co_percent_value: 3, co_percent_status: 1, co_percent_units: '%' },
    ]);
    expect(result.events.map((event) => event.parameterLabel)).toEqual([
      'CO (ppm)',
      'CO (ppm)',
      'CO (%)',
      'CO (%)',
    ]);
    expect(evaluateExceedanceHour(point(), hour, [{ ...row, co_units: '%' }]).events).toHaveLength(
      0,
    );
    expect(evaluateExceedanceHour(point(), hour, [{ ...row, co_units: null }]).events).toHaveLength(
      0,
    );
  });
  it('blocks an exceedance that SQL DECIMAL storage would round down to equality', () => {
    const result = evaluateExceedanceHour(point(), hour, [{ ...row, co_value: 120.00000001 }]);
    expect(result.events.map((event) => event.thresholdType)).toEqual(['EIA']);
    expect(result.issues).toContain('DECIMAL_PRECISION');
  });
  it('does not evaluate a parameter before its verified activation', () => {
    const target = point();
    target.parameters[0].activatedAt = '2026-11-03T10:01:00+07:00';
    expect(evaluateExceedanceHour(target, hour, [row]).events).toHaveLength(0);
  });
  it('maps END labels across midnight without changing the event reporting date', () => {
    const last = new Date('2026-11-03T23:00:00+07:00');
    expect(sourceHourLabel(last, 'END')).toEqual({ date: '2026-11-04', time: '00:00' });
    const result = evaluateExceedanceHour(point(), last, [row]);
    expect(result.events[0].eventDate).toBe('2026-11-03');
  });
  it('accepts SQL date/time values only when they identify the configured whole hour', () => {
    const expected = { date: '2026-11-03', time: '10:00' };
    expect(
      isSourceHour(
        { cdate: new Date('2026-11-03T00:00:00Z'), ctime: new Date('1970-01-01T10:00:00Z') },
        expected,
      ),
    ).toBe(true);
    expect(isSourceHour({ cdate: expected.date, ctime: '10:00:00.0000000' }, expected)).toBe(true);
    expect(isSourceHour({ cdate: expected.date, ctime: '10:00:01' }, expected)).toBe(false);
    expect(isSourceHour({ cdate: expected.date, ctime: '10:32:00' }, expected)).toBe(false);
  });
});
