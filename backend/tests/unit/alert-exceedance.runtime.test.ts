import { describe, expect, it } from '@jest/globals';
import type { Knex } from 'knex';
import { exceedanceDatabaseConfig } from '../../src/modules/alert-exceedances/exceedance-runtime';
import { readExceedancePolicy } from '../../src/modules/alert-exceedances/exceedance-policy';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('exceedance runtime isolation and published behavior', () => {
  it('uses one source connection and native request timeouts independently from the API pool', () => {
    const policy = readExceedancePolicy({
      ALERT_EXCEEDANCE_MODE: 'shadow',
      ALERT_EXCEEDANCE_STATIONS: 'S1',
      ALERT_EXCEEDANCE_CUTOVER: '2026-11-03T00:00:00+07:00',
      ALERT_EXCEEDANCE_HOUR_LABEL: 'START',
    });
    if (policy.mode === 'off') throw new Error('Expected enabled test policy');
    for (const source of [true, false]) {
      const config = exceedanceDatabaseConfig(policy, source);
      expect(config.pool).toEqual({ min: 0, max: 1 });
      const connection = config.connection as Knex.MsSqlConnectionConfig;
      expect(connection.requestTimeout).toBe(5000);
      expect(connection.options).toMatchObject({ useUTC: true, appName: 'POMS-hourly-exceedance' });
    }
  });
  it('documents opt-in detector events and shadow isolation in the runtime OpenAPI contract', () => {
    const paths = pomsOpenApiDocument.paths as Record<string, { get?: { description?: string } }>;
    const description = paths['/alert-events'].get?.description;
    expect(description).toContain('ALERT_EXCEEDANCE_MODE=active');
    expect(description).toContain('shadow ไม่สร้าง alert event หรืออีเมล');
    expect(description).toContain('measuredValue > thresholdValue');
  });
});
