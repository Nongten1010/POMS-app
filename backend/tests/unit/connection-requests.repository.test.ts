import { describe, expect, it } from '@jest/globals';
import {
  buildStatusHistoryNoteForTests,
  buildBaseQueryForTests,
  buildDuplicateActiveMeasurementPointCleanupSqlForTests,
  buildFactoriesForAccessQueryForTests,
  buildRequestNoPrefix,
  shouldIssueWaitingConnectionSideEffectsForTests,
} from '../../src/modules/connection-requests/connection-requests.repository';
import { CONNECTION_REQUEST_STATUS } from '../../src/modules/connection-requests/connection-requests.types';

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
    expect(sql).toContain('[cmp].[point_name]');
    expect(sql).toContain('cmp.source_measurement_point_id');
    expect(sql).toContain('mp.point_code');
    expect(sql).toContain('[mp].[point_name]');
  });

  it('does not link selected station history by duplicate measurement point names alone', () => {
    const sql = buildBaseQueryForTests(
      { stationId: 'S0001' },
      { actorUserId: 42, scope: 'ALL' },
    )
      .toSQL()
      .sql.toLowerCase();

    expect(sql).not.toContain('mp.point_name = cmp.point_name');
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

  it('soft-deletes duplicate active measurement points before issuing station codes', () => {
    const sql = buildDuplicateActiveMeasurementPointCleanupSqlForTests().toLowerCase();

    expect(sql).toContain('row_number() over');
    expect(sql).toContain('partition by request_id, lower(ltrim(rtrim(point_name)))');
    expect(sql).toContain("nullif(ltrim(rtrim(point_code)), '') is null");
    expect(sql).toContain('deleted_at = sysdatetime()');
    expect(sql).toContain('where ranked.duplicate_rank > 1');
  });

  it('can skip waiting-connection point-code side effects for config revision returns', () => {
    expect(
      shouldIssueWaitingConnectionSideEffectsForTests(
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      ),
    ).toBe(true);
    expect(
      shouldIssueWaitingConnectionSideEffectsForTests(
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        { issueWaitingConnectionSideEffects: false },
      ),
    ).toBe(false);
    expect(
      shouldIssueWaitingConnectionSideEffectsForTests(
        CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
      ),
    ).toBe(false);
  });

  it('keeps both revision reason and officer note in status history notes', () => {
    expect(
      buildStatusHistoryNoteForTests({
        revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
        officerNote: 'แก้ mapping channel แล้วส่งยืนยันอีกครั้ง',
      }),
    ).toBe('ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง\nแก้ mapping channel แล้วส่งยืนยันอีกครั้ง');
  });
});
