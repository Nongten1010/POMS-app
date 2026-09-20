import { describe, expect, it } from '@jest/globals';
import {
  assertBodCodCreator,
  assertCurrentBodCodPeriod,
  currentBodCodPeriod,
  nextBodCodReportSequence,
  supportsBodCodParameter,
  type BodCodAnnualReport,
} from '../../src/modules/bod-cod-deviations/bod-cod-report-submission-policy';
import { buildBodCodAllowedActionsForTests } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import type {
  BodCodApprovalRoleCode,
  BodCodDeviationReportStatus,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';

describe('BOD/COD submission policy', () => {
  it('recognizes bare codes and mg/l labels without accepting another unit or parameter', () => {
    expect(supportsBodCodParameter(['BOD'], 'BOD')).toBe(true);
    expect(supportsBodCodParameter(['BOD (mg/l)'], 'BOD')).toBe(true);
    expect(supportsBodCodParameter([' COD (mg/L) '], 'COD')).toBe(true);
    expect(supportsBodCodParameter(['BOD (ppm)', 'COD (mg/l)'], 'BOD')).toBe(false);
  });

  it.each([
    ['2026-06-30T16:59:59.999Z', 2569, 1],
    ['2026-06-30T17:00:00.000Z', 2569, 2],
    ['2026-12-31T16:59:59.999Z', 2569, 2],
    ['2026-12-31T17:00:00.000Z', 2570, 1],
  ])('uses Bangkok calendar at %s', (time, year, round) => {
    expect(currentBodCodPeriod(new Date(time))).toEqual({ reportYear: year, reportRoundNo: round });
  });

  it('rejects a form held open across a half-year boundary', () => {
    expect(() =>
      assertCurrentBodCodPeriod(
        { reportYear: 2569, reportRoundNo: 1 },
        new Date('2026-06-30T17:00:00Z'),
      ),
    ).toThrow('report period is closed');
  });

  it('allows admin creation but denies ordinary officers and missing roles', () => {
    expect(() =>
      assertBodCodCreator({ actorUserId: 1, scope: 'ALL', roles: ['admin'] }),
    ).not.toThrow();
    expect(() =>
      assertBodCodCreator({ actorUserId: 1, scope: 'OWN_FACTORY', roles: ['factory_operator'] }),
    ).not.toThrow();
    expect(() =>
      assertBodCodCreator({ actorUserId: 1, scope: 'ALL', roles: ['monitoring_kpm'] }),
    ).toThrow();
    expect(() =>
      assertBodCodCreator({ actorUserId: 1, scope: 'OWN_FACTORY', roles: [] }),
    ).toThrow();
  });

  it('increments only after approval and reuses the failed/cancelled attempt number', () => {
    const approved: BodCodAnnualReport = { id: 1, status: 'APPROVED', report_sequence_no: 1 };
    expect(nextBodCodReportSequence([])).toBe(1);
    expect(nextBodCodReportSequence([approved])).toBe(2);
    expect(
      nextBodCodReportSequence([
        approved,
        { id: 2, status: 'REJECTED', report_sequence_no: 2 },
        { id: 3, status: 'CANCELLED', report_sequence_no: 2 },
      ]),
    ).toBe(2);
    expect(
      nextBodCodReportSequence([approved, { id: 4, status: 'APPROVED', report_sequence_no: 2 }]),
    ).toBe(3);
  });

  it('uses approved legacy records as a baseline without rewriting them', () => {
    const reports: BodCodAnnualReport[] = [
      { id: 1, status: 'APPROVED', report_sequence_no: null },
      { id: 2, status: 'APPROVED', report_sequence_no: null },
      { id: 3, status: 'REJECTED', report_sequence_no: null },
    ];
    expect(nextBodCodReportSequence(reports)).toBe(3);
    expect(reports.every((report) => report.report_sequence_no === null)).toBe(true);
  });

  it.each([
    'DRAFT',
    'SUBMITTED',
    'REVISION_REQUESTED',
    'REVISED_PENDING_REVIEW',
    'WAITING_RESULT_NOTICE',
    'WAITING_REVIEW',
    'WAITING_APPROVAL',
  ] as const)('blocks an existing %s request', (status) => {
    expect(() => nextBodCodReportSequence([{ id: 7, status, report_sequence_no: 1 }])).toThrow(
      'still pending',
    );
  });

  it.each([
    ['WAITING_REVIEW', 'REVIEWER', 'admin', false],
    ['WAITING_APPROVAL', 'APPROVER', 'admin', false],
    ['WAITING_REVIEW', 'REVIEWER', 'kpm_director', true],
    ['WAITING_APPROVAL', 'APPROVER', 'center_director', true],
    ['WAITING_APPROVAL', 'APPROVER', 'kwp_director', true],
    ['WAITING_RESULT_NOTICE', 'RESULT_NOTICE', 'monitoring_5_centers', false],
    ['WAITING_RESULT_NOTICE', 'RESULT_NOTICE', 'monitoring_kpm', true],
    ['WAITING_RESULT_NOTICE', 'RESULT_NOTICE', 'admin', true],
    ['WAITING_APPROVAL', 'INSPECTOR', 'admin', false],
  ] as [BodCodDeviationReportStatus, BodCodApprovalRoleCode, string, boolean][])(
    'checks status %s, step %s and role %s',
    (status, roleCode, role, allowed) => {
      const actions = buildBodCodAllowedActionsForTests(
        status,
        { stepNo: 1, roleCode, roleLabel: '', status: 'PENDING', isCurrent: true },
        'ALL',
        [role],
      );
      expect(actions.includes('APPROVE')).toBe(allowed);
    },
  );

  it('allows owner cancellation after rejection but never after approval or cancellation', () => {
    expect(
      buildBodCodAllowedActionsForTests('REJECTED', null, 'OWN_FACTORY', ['factory_operator']),
    ).toEqual(['CANCEL']);
    for (const status of ['APPROVED', 'CANCELLED'] as const) {
      expect(
        buildBodCodAllowedActionsForTests(status, null, 'OWN_FACTORY', ['factory_operator']),
      ).toEqual([]);
    }
  });
});
