import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormFactoryQueryForTests,
  buildKwpFormRequestQueryForTests,
} from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';

describe('kwpFormReportsRepository access filters', () => {
  it('builds factory table data from current connected points and limits operators to assigned juristics', () => {
    const sql = buildKwpFormFactoryQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toContain('left join [eligible_factories] as [ef]');
    expect(sql).toContain('inner join [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).not.toContain('from [cems_wpms_connection_requests] as [cr]');
    expect(sql).toContain('[ef].[business_activity]');
    expect(sql).toContain('[ef].[factory_type_sequence]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
  });

  it('keeps officer factory table broad when scope is ALL', () => {
    const sql = buildKwpFormFactoryQueryForTests({
      actorUserId: 77,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).not.toContain('join [user_juristics] as [uj]');
  });

  it('builds request rows from KWP submissions and filters officers by assigned regions', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      { formType: 'KWP03', status: 'UNDER_REVIEW' },
      {
        actorUserId: 77,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคกลาง'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('[p].[region]');
    expect(compiled.bindings).toEqual(
      expect.arrayContaining(['KWP03', 'UNDER_REVIEW', 'ภาคกลาง']),
    );
  });

  it('limits operator request rows to assigned juristics', () => {
    const sql = buildKwpFormRequestQueryForTests({}, { actorUserId: 42, scope: 'OWN_FACTORY' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
  });
});
