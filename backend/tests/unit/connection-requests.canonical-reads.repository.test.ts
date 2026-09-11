import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { env } from '../../src/config/env';
import {
  buildConnectedFactoriesForAccessQueryForTests,
  buildConnectedMeasurementPointsQueryForTests,
  buildCurrentPomsFactoryNamesQueryForTests,
  buildDirectConnectionFactoryQueryForTests,
  buildFactoriesForAccessQueryForTests,
} from '../../src/modules/connection-requests/connection-requests.repository';

const previousMode = env.FACTORY_PROFILE_MODE;
describe('connection current reads in canonical profile mode', () => {
  beforeEach(() => {
    env.FACTORY_PROFILE_MODE = 'canonical';
  });
  afterEach(() => {
    env.FACTORY_PROFILE_MODE = previousMode;
  });

  it.each([
    [
      'operator factories',
      () => buildFactoriesForAccessQueryForTests({ actorUserId: 7, scope: 'ALL' }),
    ],
    [
      'connected factories',
      () => buildConnectedFactoriesForAccessQueryForTests({ actorUserId: 7, scope: 'ALL' }),
    ],
    [
      'direct lookup',
      () =>
        buildDirectConnectionFactoryQueryForTests(
          { factoryId: '17', factoryRegistrationNo: '17' },
          { actorUserId: 7, scope: 'ALL' },
        ),
    ],
  ] as const)('%s uses the canonical eligible profile for current fields', (_name, makeQuery) => {
    expect(makeQuery().toSQL().sql.toLowerCase()).toContain('current_eligible_factories');
  });

  it.each([
    ['connected points', () => buildConnectedMeasurementPointsQueryForTests(['17'], [17])],
    ['current names', () => buildCurrentPomsFactoryNamesQueryForTests(['17'], [17])],
  ] as const)('%s reads current canonical point profiles', (_name, makeQuery) => {
    expect(makeQuery().toSQL().sql.toLowerCase()).toMatch(
      /current_(?:cems_wpms_)?connected_measurement_points/,
    );
  });

  it('uses current estate for estate-scoped access rather than the login master estate', () => {
    const query = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 7,
      scope: { scope: 'IN_ESTATE', estate: 'IE-01', province: null, region: null },
    }).toSQL();
    expect(query.sql.toLowerCase()).toContain('ie.name_th = ef.industrial_estate_name');
  });

  it('keeps canonical province and estate display labels even when lookup tables do not contain them', () => {
    const sql = buildConnectedFactoriesForAccessQueryForTests({ actorUserId: 7, scope: 'ALL' })
      .toSQL()
      .sql.toLowerCase();
    expect(sql).toContain('[ef].[province_name] as [province_name]');
    expect(sql).toContain('[ef].[industrial_estate_name] as [industrial_estate_name]');
  });

  it('retains assigned access and current province restrictions', () => {
    const query = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 7,
      scope: 'OWN_FACTORY',
    }).toSQL();
    expect(query.sql.toLowerCase()).toContain('user_factory_access');
    expect(query.bindings).toContain(7);
    const regional = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 7,
      scope: { scope: 'IN_PROVINCE', province: 'นนทบุรี', region: null },
    }).toSQL();
    expect(regional.sql.toLowerCase()).toContain('[p].[name_th] = [ef].[province_name]');
    expect(regional.bindings).toContain('นนทบุรี');
  });
});
