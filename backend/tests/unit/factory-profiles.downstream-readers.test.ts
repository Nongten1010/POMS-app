import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { env } from '../../src/config/env';
import {
  buildKwpFormFactoryQueryForTests,
  buildKwpFormRequestQueryForTests,
} from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';
import {
  buildKwpFormSubmissionDetailQueryForTests,
  buildKwpFormSubmissionFactoryAccessQueryForTests,
  buildKwpSubmissionRegionQueryForTests,
  buildKwpFormSubmissionWorkflowQueryForTests,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';
import {
  buildBodCodDeviationFactoryQueryForTests,
  buildBodCodDeviationReportQueryForTests,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import { buildBodCodNumberingFactoryQueryForTests } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-report-numbering.repository';
import {
  buildStationAccessQueryForTests,
  buildWaitingConnectionStationAccessQueryForTests,
} from '../../src/modules/parameter-values/parameter-values.repository';
import { buildAlertEventsAccessQueryForTests } from '../../src/modules/alert-events/alert-events.repository';

const provinceAccess = {
  actorUserId: 71,
  scope: { scope: 'IN_PROVINCE', province: 'ราชบุรี' },
} as const;
const originalMode = env.FACTORY_PROFILE_MODE;
beforeEach(() => {
  env.FACTORY_PROFILE_MODE = 'canonical';
});
afterEach(() => {
  env.FACTORY_PROFILE_MODE = originalMode;
});

function sqlOf(query: { toSQL: () => { sql: string } }): string {
  return query.toSQL().sql.toLowerCase().replace(/\s+/gu, ' ');
}

function expectCanonicalProvince(sql: string, provinceAlias = 'p'): void {
  expect(sql).toContain('current_eligible_factories');
  expect(sql).toContain(`[${provinceAlias}].[name_th] = [ef].[province_name]`);
  expect(sql).toContain('[ef].[id] is null');
  expect(sql).not.toContain(
    `on [${provinceAlias}].[id] = [f].[province_id] or [${provinceAlias}].[name_th] = [ef].[province_name]`,
  );
}

describe('canonical current downstream factory readers', () => {
  it('uses shared current data for KWP factories while keeping outward factory IDs', () => {
    const sql = sqlOf(buildKwpFormFactoryQueryForTests(provinceAccess));
    expect(sql).toContain('from current_eligible_factories as ef_source');
    expect(sql).toContain('current_connected_measurement_points');
    expect(sql).toContain('[f].[id] as [factory_id]');
    expect(sql).toContain('ef.id is null and p_source.id = f.province_id');
  });

  it('keeps KWP submitted names and addresses as snapshots beside current display fields', () => {
    const sql = sqlOf(buildKwpFormRequestQueryForTests({}, provinceAccess));
    expect(sql).toContain('current_connected_measurement_points');
    expect(sql).toContain('current_eligible_factories');
    expect(sql).toContain('[s].[factory_name]');
    expect(sql).toContain('[s].[factory_address]');
    expect(sql).toContain('current_factory_name');
    expect(sql).toContain('coalesce([s].[submission_region_name], [p].[region])');
  });

  it('allocates new KWP numbers from current province while preserving factory lookup IDs', () => {
    const query = buildKwpSubmissionRegionQueryForTests('FID-001');
    expectCanonicalProvince(sqlOf(query));
    expect(query.toSQL().bindings).toEqual(expect.arrayContaining(['FID-001']));
  });

  it('checks submission access in current province without accepting an obsolete master province', () => {
    const sql = sqlOf(buildKwpFormSubmissionFactoryAccessQueryForTests('FID-001', provinceAccess));
    expect(sql).toContain('current_eligible_factories');
    expect(sql).toContain('p.name_th = ef.province_name');
    expect(sql).toContain('ef.id is null');
  });

  it('uses current province for KWP details but preserves submitted factory fields', () => {
    const sql = sqlOf(
      buildKwpFormSubmissionDetailQueryForTests(13, {
        ...provinceAccess,
        formType: 'KWP02',
        publicBaseUrl: 'https://fixture.invalid',
        publicPath: '/uploads',
      }),
    );
    expectCanonicalProvince(sql);
    expect(sql).toContain('[s].[factory_name]');
    expect(sql).toContain('[s].[factory_address]');
  });

  it('preserves the saved numbering region while using current province for KWP workflow access', () => {
    const sql = sqlOf(buildKwpFormSubmissionWorkflowQueryForTests(13, provinceAccess));
    expectCanonicalProvince(sql);
    expect(sql).toContain('coalesce([s].[submission_region_name], [p].[region])');
  });

  it('uses canonical BOD factory scope and stable connected-point IDs', () => {
    const sql = sqlOf(buildBodCodDeviationFactoryQueryForTests(provinceAccess));
    expectCanonicalProvince(sql);
    expect(sql).toContain('current_connected_measurement_points');
    expect(sql).toContain('[ef].[id] = [cp].[eligible_factory_id]');
    expect(sql).toContain('[cp].[id] as [connected_point_id]');
  });

  it('uses the same current province for BOD numbering as the current factory menu', () => {
    const sql = sqlOf(
      buildBodCodNumberingFactoryQueryForTests(
        { factoryId: 'FID-001', factoryRegistrationNo: 'REG-001' },
        provinceAccess,
      ),
    );
    expectCanonicalProvince(sql);
    expect(sql).toContain('[f].[id] as [factory_internal_id]');
    expect(sql).toContain('[p].[region] as [region_name]');
  });

  it('keeps BOD report province and submitted factory name historical', () => {
    const sql = sqlOf(buildBodCodDeviationReportQueryForTests({}, provinceAccess));
    expect(sql).toContain('current_eligible_factories');
    expect(sql).toContain('[p].[name_th] = [r].[province_name]');
    expect(sql).toContain('[r].[factory_name]');
    expect(sql).toContain('[r].[province_name]');
    expect(sql).not.toContain('[p].[name_th] = [ef].[province_name]');
  });

  it('does not grant old-province access to current parameter values after a province change', () => {
    const query = buildStationAccessQueryForTests(provinceAccess);
    expectCanonicalProvince(sqlOf(query), 'pr');
    expect(sqlOf(query)).toContain('current_connected_measurement_points');
    expect(query.toSQL().bindings).toContain('ราชบุรี');
  });

  it('does not grant old-province access to alerts and keeps event snapshots unchanged', () => {
    const query = buildAlertEventsAccessQueryForTests(provinceAccess);
    expectCanonicalProvince(sqlOf(query));
    expect(sqlOf(query)).toContain('[alert_events].*');
    expect(query.toSQL().bindings).toContain('ราชบุรี');
  });

  it('uses current estate names and allows master estate fallback only when eligible factory is absent', () => {
    const estateAccess = {
      actorUserId: 71,
      scope: { scope: 'IN_ESTATE', estateCode: 'IE-FIXTURE' },
    } as const;
    const queries = [
      buildStationAccessQueryForTests(estateAccess),
      buildAlertEventsAccessQueryForTests(estateAccess),
      buildBodCodDeviationFactoryQueryForTests(estateAccess),
    ];
    for (const query of queries) {
      const sql = sqlOf(query);
      expect(sql).toContain('[ie].[name_th] = [ef].[industrial_estate_name]');
      expect(sql).toContain('[ef].[id] is null and [ie].[id] = [f].[industrial_estate_id]');
    }
  });

  it('preserves pending connection request snapshots before a connection exists', () => {
    const sql = sqlOf(buildWaitingConnectionStationAccessQueryForTests(provinceAccess));
    expect(sql).toContain('cems_wpms_connection_requests');
    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).not.toContain('current_connected_measurement_points');
  });

  it('preserves OWN_FACTORY user assignment and fail-closed missing province scopes', () => {
    const own = sqlOf(buildStationAccessQueryForTests({ actorUserId: 71, scope: 'OWN_FACTORY' }));
    expect(own).toContain('user_factory_access');
    const missing = buildStationAccessQueryForTests({
      actorUserId: 71,
      scope: { scope: 'IN_PROVINCE', province: null },
    });
    expect(sqlOf(missing)).toMatch(/1 = \??0?/u);
  });
});

describe('legacy downstream compatibility', () => {
  it('retains old read sources and numbering joins before canonical rollout is enabled', () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    const queries = [
      buildKwpFormFactoryQueryForTests(provinceAccess),
      buildKwpSubmissionRegionQueryForTests('FID-001'),
      buildBodCodDeviationFactoryQueryForTests(provinceAccess),
      buildBodCodNumberingFactoryQueryForTests(
        { factoryId: 'FID-001', factoryRegistrationNo: 'REG-001' },
        provinceAccess,
      ),
      buildStationAccessQueryForTests(provinceAccess),
      buildAlertEventsAccessQueryForTests(provinceAccess),
    ].map(sqlOf);
    for (const sql of queries) expect(sql).not.toContain('current_eligible_factories');
    expect(queries[1]).toContain('[p].[id] = [f].[province_id]');
    expect(queries[3]).toContain('[p].[id] = [f].[province_id]');
  });
});
