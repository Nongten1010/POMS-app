import { describe, expect, it } from '@jest/globals';
import {
  buildBodCodApprovalStepsForTests,
  buildBodCodCreateAccessQueryForTests,
  buildBodCodDeviationFactoryQueryForTests,
  buildBodCodDeviationLatestReportSlotMapForTests,
  buildBodCodDeviationReportDetailQueryForTests,
  buildBodCodDeviationReportQueryForTests,
  buildBodCodFactoryInternalIdQueryForTests,
  buildBodCodNextWorkflowStateForTests,
  buildBodCodAllowedActionsForTests,
  buildBodCodReportStatusLabelForTests,
  buildBodCodResubmissionAccessQueryForTests,
  buildBodCodResubmissionWorkflowResetQueriesForTests,
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

  it('filters report requests by revised pending review status', () => {
    const compiled = buildBodCodDeviationReportQueryForTests(
      { status: 'REVISED_PENDING_REVIEW' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[r].[status]');
    expect(compiled.bindings).toContain('REVISED_PENDING_REVIEW');
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

  it('loads report details through the same access filters as the report list', () => {
    const compiled = buildBodCodDeviationReportDetailQueryForTests(9, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [bod_cod_deviation_reports] as [r]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[r].[id]');
    expect(compiled.bindings).toContain(9);
  });

  it('builds the documented central three-step and regional two-step workflow', () => {
    expect(buildBodCodApprovalStepsForTests('CENTRAL')).toEqual([
      { stepNo: 1, roleCode: 'INSPECTOR', roleLabel: 'เจ้าหน้าที่กฝม.' },
      { stepNo: 2, roleCode: 'REVIEWER', roleLabel: 'ผอ.กฝม. (ทบทวน)' },
      { stepNo: 3, roleCode: 'APPROVER', roleLabel: 'ผอ.กวภ. (อนุมัติ)' },
    ]);
    expect(buildBodCodApprovalStepsForTests('REGIONAL')).toEqual([
      { stepNo: 1, roleCode: 'INSPECTOR', roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์' },
      { stepNo: 2, roleCode: 'APPROVER', roleLabel: 'ผอ.ศูนย์ (อนุมัติ)' },
    ]);
  });

  it('shows operator-facing in-review labels until final approval', () => {
    expect(buildBodCodReportStatusLabelForTests('SUBMITTED', 'OWN_FACTORY')).toBe('รอพิจารณา');
    expect(buildBodCodReportStatusLabelForTests('REVISED_PENDING_REVIEW', 'OWN_FACTORY')).toBe(
      'รอพิจารณา',
    );
    expect(buildBodCodReportStatusLabelForTests('WAITING_APPROVAL', 'OWN_FACTORY')).toBe(
      'รอพิจารณา',
    );
    expect(buildBodCodReportStatusLabelForTests('APPROVED', 'OWN_FACTORY')).toBe('ผ่านการพิจารณา');
    expect(buildBodCodReportStatusLabelForTests('REVISED_PENDING_REVIEW', 'ALL')).toBe(
      'แก้ไขแล้ว/รอพิจารณา',
    );
  });

  it('exposes officer BOD/COD workflow actions while the current step is pending', () => {
    const currentStep = {
      stepNo: 1,
      roleCode: 'INSPECTOR' as const,
      roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์',
      status: 'PENDING' as const,
      isCurrent: true,
    };

    expect(buildBodCodAllowedActionsForTests('SUBMITTED', currentStep, 'ALL')).toEqual([
      'APPROVE',
      'REQUEST_REVISION',
      'REJECT',
    ]);
    expect(buildBodCodAllowedActionsForTests('APPROVED', currentStep, 'ALL')).toEqual([]);
    expect(buildBodCodAllowedActionsForTests('REJECTED', currentStep, 'ALL')).toEqual([]);
  });

  it('maps BOD/COD workflow actions to the next report and step state', () => {
    expect(buildBodCodNextWorkflowStateForTests('APPROVE', true)).toEqual({
      currentStepStatus: 'APPROVED',
      nextStepStatus: 'PENDING',
      reportStatus: 'WAITING_APPROVAL',
      closesWorkflow: false,
    });
    expect(buildBodCodNextWorkflowStateForTests('APPROVE', false)).toEqual({
      currentStepStatus: 'APPROVED',
      nextStepStatus: null,
      reportStatus: 'APPROVED',
      closesWorkflow: true,
    });
    expect(buildBodCodNextWorkflowStateForTests('REQUEST_REVISION', false)).toEqual({
      currentStepStatus: 'REVISION_REQUESTED',
      nextStepStatus: null,
      reportStatus: 'REVISION_REQUESTED',
      closesWorkflow: false,
    });
    expect(buildBodCodNextWorkflowStateForTests('REJECT', false)).toEqual({
      currentStepStatus: 'REJECTED',
      nextStepStatus: null,
      reportStatus: 'REJECTED',
      closesWorkflow: true,
    });
  });

  it('checks own-factory edit access before saving a submitted form', () => {
    const compiled = buildBodCodCreateAccessQueryForTests(
      {
        factoryId: 'FID-001',
        factoryRegistrationNo: '10520000225172',
      },
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
    expect(compiled.bindings).toEqual(expect.arrayContaining([42, 'FID-001', '10520000225172']));
  });

  it('resolves a frontend factory identifier to the internal factories.id before saving', () => {
    const compiled = buildBodCodFactoryInternalIdQueryForTests(
      {
        factoryId: '72110100225390',
        factoryRegistrationNo: 'น.60-2/2539-ญอน.',
      },
      {
        actorUserId: 77,
        scope: 'ALL',
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('select top (?) [f].[id]');
    expect(sql).toContain('[f].[id]');
    expect(sql).toContain('[f].[fid]');
    expect(sql).toContain('[f].[code]');
    expect(sql).not.toContain('join [user_juristics] as [uj]');
    expect(compiled.bindings).toEqual(
      expect.arrayContaining([1, 72110100225390, '72110100225390', 'น.60-2/2539-ญอน.']),
    );
  });

  it('checks own-factory access and the current approval step before resubmission', () => {
    const compiled = buildBodCodResubmissionAccessQueryForTests(9, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [bod_cod_deviation_reports] as [r]');
    expect(sql).toContain('left join [bod_cod_approval_steps] as [s]');
    expect(sql).toContain('[s].[is_current]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
    expect(compiled.bindings).toEqual(expect.arrayContaining([9, 42]));
  });

  it('resets corrected reports back to the first approval step', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    const { resetAllSteps, restartFirstStep } = buildBodCodResubmissionWorkflowResetQueriesForTests(
      9,
      now,
    );
    const resetAllSql = resetAllSteps.toSQL();
    const restartFirstSql = restartFirstStep.toSQL();

    expect(resetAllSql.sql.toLowerCase()).toContain('[bod_cod_approval_steps]');
    expect(resetAllSql.bindings).toEqual(expect.arrayContaining(['WAITING', false, 9]));
    expect(restartFirstSql.sql.toLowerCase()).toContain('[step_no]');
    expect(restartFirstSql.bindings).toEqual(expect.arrayContaining(['PENDING', true, 9, 1]));
  });
});
