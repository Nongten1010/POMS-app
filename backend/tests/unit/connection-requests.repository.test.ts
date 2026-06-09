import { describe, expect, it } from '@jest/globals';
import {
  buildBaseQueryForTests,
  buildFactoriesForAccessQueryForTests,
  buildRequestNoPrefix,
} from '../../src/modules/connection-requests/connection-requests.repository';

describe('connectionRequestsRepository request numbers', () => {
  it('builds request number prefixes from system type and Thai Buddhist year', () => {
    const date = new Date('2026-05-30T12:00:00.000+07:00');

    expect(buildRequestNoPrefix('CEMS', date)).toBe('CEMS-69');
    expect(buildRequestNoPrefix('WPMS', date)).toBe('WPMS-69');
  });

  it('filters request history by selected station aliases from connected measurement points', () => {
    const sql = buildBaseQueryForTests(
      { stationId: 'S0001' },
      { actorUserId: 42, scope: 'ALL' },
    ).toSQL().sql;

    expect(sql).toContain('cems_wpms_connected_measurement_points');
    expect(sql).toContain('cmp.point_code');
    expect(sql).toContain('cmp.point_name');
    expect(sql).toContain('cmp.source_measurement_point_id');
    expect(sql).toContain('mp.point_code');
    expect(sql).toContain('mp.point_name');
  });

  it('keeps operator factory access even when no eligible factory record exists', () => {
    const sql = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('left join [eligible_factories] as [ef]');
    expect(sql).not.toContain('inner join [eligible_factories] as [ef]');
    expect(sql).toContain('[ef].[factory_registration_no_new] = [f].[code]');
    expect(sql).toContain('[ef].[source_factory_id] = [f].[fid]');
    expect(sql).toContain('[ef].[deleted_at] is null');
  });
});
