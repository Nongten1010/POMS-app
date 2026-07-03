import { describe, expect, it } from '@jest/globals';
import {
  buildBodCodDeviationFactoryQueryForTests,
  buildBodCodDeviationLatestReportSlotMapForTests,
  buildBodCodDeviationReportQueryForTests,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';

describe('bodCodDeviationReportsRepository access filters', () => {
  it('builds factory table data from connected measurement points and limits operators to assigned juristics', () => {
    const sql = buildBodCodDeviationFactoryQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
  });

  it('keeps officer connected factory table broad when scope is ALL', () => {
    const sql = buildBodCodDeviationFactoryQueryForTests({
      actorUserId: 77,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).not.toContain('join [user_juristics] as [uj]');
  });

  it('filters officer report requests by assigned regions', () => {
    const compiled = buildBodCodDeviationReportQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคเหนือ'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [bod_cod_deviation_reports] as [r]');
    expect(sql).toContain('[f].[code] = [r].[factory_registration_no]');
    expect(sql).toContain('[p].[region]');
    expect(compiled.bindings).toContain('ภาคเหนือ');
  });

  it('filters report requests by status and parameter code', () => {
    const compiled = buildBodCodDeviationReportQueryForTests(
      { status: 'SUBMITTED', parameterCode: 'BOD' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[r].[status]');
    expect(compiled.sql.toLowerCase()).toContain('[r].[selected_parameter_code]');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['SUBMITTED', 'BOD']));
  });

  it('keeps the newest current-year report slot when duplicate point and round rows are returned', () => {
    const slotMap = buildBodCodDeviationLatestReportSlotMapForTests([
      {
        factory_id: 1,
        connected_measurement_point_id: 9,
        point_code: 'WP001',
        factory_registration_no: '10190000225448',
        report_round: 1,
        report_year: 2569,
        report_id: 20,
        report_no: 'BODCOD-2569-0020',
        status: 'APPROVED',
      },
      {
        factory_id: 1,
        connected_measurement_point_id: 9,
        point_code: 'WP001',
        factory_registration_no: '10190000225448',
        report_round: 1,
        report_year: 2569,
        report_id: 10,
        report_no: 'BODCOD-2569-0010',
        status: 'SUBMITTED',
      },
    ]);

    expect(slotMap.get('9:1')).toMatchObject({
      report_id: 20,
      status: 'APPROVED',
    });
    expect(slotMap.get('WP001:1')).toMatchObject({
      report_id: 20,
      status: 'APPROVED',
    });
  });
});
