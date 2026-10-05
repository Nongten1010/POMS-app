import { describe, expect, it } from '@jest/globals';
import {
  createIntegrationAlertEventSchema,
  listAlertEventsQuerySchema,
} from '../../src/modules/alert-events/alert-events.validator';

function event(overrides: Record<string, unknown> = {}) {
  return createIntegrationAlertEventSchema.parse({
    systemType: 'CEMS',
    stationId: 'S0001',
    parameterCode: 'co',
    unit: 'ppm',
    eventDate: '2026-10-04',
    time: '11:00',
    measuredValue: 250,
    thresholdValue: 200,
    thresholdType: 'STANDARD',
    ...overrides,
  });
}

describe('integration alert identity and calendar validation', () => {
  it('uses distinct idempotency identities for CO in ppm and percent', () => {
    expect(event({ unit: 'ppm' }).idempotencyKey).not.toBe(event({ unit: '%' }).idempotencyKey);
  });

  it('returns an opaque bounded v2 key rather than making consumers parse event identity', () => {
    expect(event().idempotencyKey).toMatch(/^v2:[a-f0-9]{64}$/);
    expect(
      event({ stationId: 'S'.repeat(128), unit: 'u'.repeat(64) }).idempotencyKey.length,
    ).toBeLessThanOrEqual(220);
  });

  it('normalizes casing and outer whitespace in the unit only for identity comparison', () => {
    const first = event({ parameterCode: 'BOD', unit: ' mg/L ' });
    const second = event({ parameterCode: 'bod', unit: 'mg/l' });
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.unit).toBe('mg/L');
    expect(first.parameterLabel).toBe('BOD (mg/L)');
  });

  it.each([
    { stationId: 'S0002' },
    { parameterCode: 'cod' },
    { thresholdType: 'EIA' },
    { eventDate: '2026-10-03' },
    { time: '12:00' },
    { systemType: 'WPMS' },
  ])('keeps another event dimension distinct: %j', (overrides) => {
    expect(event(overrides).idempotencyKey).not.toBe(event().idempotencyKey);
  });

  it('does not treat a changed value as a new copy of the same hourly event', () => {
    expect(event({ measuredValue: 300, thresholdValue: 220 }).idempotencyKey).toBe(
      event().idempotencyKey,
    );
  });

  it.each(['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10'])(
    'rejects an impossible event date: %s',
    (eventDate) => {
      expect(() => event({ eventDate })).toThrow();
    },
  );

  it.each(['2024-02-29', '2026-02-28', '2026-12-31'])(
    'accepts a real calendar event date: %s',
    (eventDate) => {
      expect(event({ eventDate }).eventDate).toBe(eventDate);
    },
  );

  it.each(['dateFrom', 'dateTo'])('rejects impossible list filter dates in %s', (field) => {
    expect(listAlertEventsQuerySchema.safeParse({ [field]: '2026-02-30' }).success).toBe(false);
  });
});
