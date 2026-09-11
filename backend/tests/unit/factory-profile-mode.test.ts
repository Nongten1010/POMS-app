import { describe, expect, it, jest } from '@jest/globals';

const config = { FACTORY_PROFILE_MODE: 'legacy' };
jest.mock('../../src/config/env', () => ({ env: config }));

import {
  factoryProfileReadTable,
  isCanonicalFactoryProfilesEnabled,
} from '../../src/modules/factory-profiles/factory-profile-mode';

describe('factory profile rollout reader', () => {
  it('keeps existing SQL sources during the preparation phase', () => {
    config.FACTORY_PROFILE_MODE = 'legacy';
    expect(isCanonicalFactoryProfilesEnabled()).toBe(false);
    expect(factoryProfileReadTable('eligible_factories', 'ef')).toBe('eligible_factories as ef');
    expect(factoryProfileReadTable('cems_wpms_connected_measurement_points')).toBe(
      'cems_wpms_connected_measurement_points',
    );
  });

  it('selects the common profile views for every current operational source', () => {
    config.FACTORY_PROFILE_MODE = 'canonical';
    expect(isCanonicalFactoryProfilesEnabled()).toBe(true);
    for (const table of [
      'eligible_factories',
      'cems_wpms_connected_measurement_points',
      'factory_monitoring_point_forms',
    ] as const) {
      const view =
        table === 'cems_wpms_connected_measurement_points'
          ? 'current_connected_measurement_points'
          : `current_${table}`;
      expect(factoryProfileReadTable(table, 'current')).toBe(`${view} as current`);
    }
  });
});
