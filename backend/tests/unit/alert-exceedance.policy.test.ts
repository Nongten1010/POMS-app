import { describe, expect, it } from '@jest/globals';
import { readExceedancePolicy } from '../../src/modules/alert-exceedances/exceedance-policy';
const settings = {
  ALERT_EXCEEDANCE_MODE: 'shadow',
  ALERT_EXCEEDANCE_STATIONS: 'S0001,P0001',
  ALERT_EXCEEDANCE_CUTOVER: '2026-11-03T00:00:00+07:00',
  ALERT_EXCEEDANCE_HOUR_LABEL: 'START',
};
describe('exceedance rollout policy', () => {
  it('is off without reading or requiring active settings, independent of email enablement', () => {
    expect(readExceedancePolicy({ ALERT_EMAIL_ENABLED: 'true' })).toEqual({ mode: 'off' });
  });
  it('requires cutover, hour semantics and a concrete allowlist for shadow', () => {
    expect(readExceedancePolicy(settings)).toMatchObject({
      mode: 'shadow',
      stations: ['S0001', 'P0001'],
      batchSize: 50,
      timeoutMs: 5000,
    });
    for (const field of [
      'ALERT_EXCEEDANCE_STATIONS',
      'ALERT_EXCEEDANCE_CUTOVER',
      'ALERT_EXCEEDANCE_HOUR_LABEL',
    ]) {
      expect(() => readExceedancePolicy({ ...settings, [field]: undefined })).toThrow();
    }
  });
  it.each(['*', 'S0001,', 'S0001];DROP TABLE x', ''])(
    'rejects unsafe station allowlist %j',
    (stations) => {
      expect(() =>
        readExceedancePolicy({ ...settings, ALERT_EXCEEDANCE_STATIONS: stations }),
      ).toThrow();
    },
  );
  it('requires explicit active policy confirmation and never enables email', () => {
    const active = { ...settings, ALERT_EXCEEDANCE_MODE: 'active' };
    expect(() => readExceedancePolicy(active)).toThrow('confirmed');
    expect(
      readExceedancePolicy({
        ...active,
        ALERT_EXCEEDANCE_NORMAL_ONLY_CONFIRMED: 'true',
        ALERT_EXCEEDANCE_DATA_BASIS_CONFIRMED: 'true',
        ALERT_EXCEEDANCE_STATION_IDS_CONFIRMED: 'true',
      }),
    ).toMatchObject({ mode: 'active' });
    expect(active).not.toHaveProperty('ALERT_EMAIL_ENABLED');
  });
  it.each([
    { ALERT_EXCEEDANCE_BATCH_SIZE: '51' },
    { ALERT_EXCEEDANCE_QUERY_TIMEOUT_MS: '0' },
    { ALERT_EXCEEDANCE_BUDGET_MS: '3600000' },
    { ALERT_EXCEEDANCE_LATE_HOURS: '999' },
  ])('bounds database work: %j', (change) => {
    expect(() => readExceedancePolicy({ ...settings, ...change })).toThrow();
  });
});
