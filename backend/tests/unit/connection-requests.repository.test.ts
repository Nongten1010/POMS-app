import { describe, expect, it } from '@jest/globals';
import {
  buildStatusHistoryNoteForTests,
  buildStatusHistoryTimelineForTests,
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

  it('selects the categorical EIA snapshot columns needed by list responses', () => {
    const sql = buildBaseQueryForTests({}, { actorUserId: 42, scope: 'ALL' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('[eia_assessment]');
    expect(sql).toContain('[eia_other]');
    expect(sql).toContain('[has_eia]');
  });

  it('does not link selected station history by duplicate measurement point names alone', () => {
    const sql = buildBaseQueryForTests({ stationId: 'S0001' }, { actorUserId: 42, scope: 'ALL' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).not.toContain('mp.point_name = cmp.point_name');
  });

  it('filters request list by factory snapshot fields for advanced search', () => {
    const sql = buildBaseQueryForTests(
      {
        provinceName: 'ระยอง',
        industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
        factoryMainTypeCode: '8802',
      },
      { actorUserId: 42, scope: 'ALL' },
    )
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).toContain('[fs].[request_id] = [cems_wpms_connection_requests].[id]');
    expect(sql).toContain('[fs].[province_name]');
    expect(sql).toContain('[fs].[industrial_estate_name]');
    expect(sql).toContain('[fs].[factory_main_type_code]');
  });

  it('limits request list to assigned officer regions when regional access is present', () => {
    const compiled = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).toContain('[fs].[region_name]');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('limits request list to selected permission province without requiring request ownership', () => {
    const compiled = buildBaseQueryForTests(
      { stationId: 'S0001' },
      {
        actorUserId: 42,
        scope: {
          scope: 'IN_PROVINCE',
          region: null,
          province: 'ฉะเชิงเทรา',
        },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).toContain('[fs].[province_name]');
    expect(sql).not.toContain('[created_by] = ?');
    expect(compiled.bindings).toContain('ฉะเชิงเทรา');
  });

  it('keeps request list owner-scoped when a province scope has no selected province', () => {
    const compiled = buildBaseQueryForTests(
      { stationId: 'S0001' },
      {
        actorUserId: 42,
        scope: {
          scope: 'IN_PROVINCE',
          region: null,
          province: null,
        },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[created_by] = ?');
    expect(compiled.bindings).toContain(42);
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

  it('selects dashboard location and industrial estate fields for advanced filters', () => {
    const sql = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('left join [industrial_estates] as [ie]');
    expect(sql).toContain('[p].[id] as [province_id]');
    expect(sql).toContain('[p].[region] as [province_region]');
    expect(sql).toContain('[ie].[code] as [industrial_estate_code]');
    expect(sql).toContain('[ie].[name_th] as [industrial_estate_name]');
  });

  it('limits factory access to assigned officer regions when regional access is present', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('limits dashboard factory access to a selected permission province', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ฉะเชิงเทรา',
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[name_th]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ฉะเชิงเทรา');
  });

  it('keeps factory access assigned when a province scope has no selected province', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: null,
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(compiled.bindings).toContain(42);
  });

  it('limits dashboard factory access to a selected permission region', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_REGION',
        region: 'ภาคตะวันออก',
        province: null,
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
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
      shouldIssueWaitingConnectionSideEffectsForTests(CONNECTION_REQUEST_STATUS.WAITING_CONNECTION),
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

  it('builds status history durations and summary from inclusive status dates', () => {
    const timeline = buildStatusHistoryTimelineForTests([
      {
        id: 1,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        note: 'ผู้ประกอบการส่งฟอร์ม',
        changed_by: 4,
        changed_by_username: 'operator_demo',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-26T22:01:35.536Z',
      },
      {
        id: 2,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        note: 'ขอเอกสารเพิ่มเติม',
        changed_by: 7,
        changed_by_username: 'officer_demo',
        changed_by_prename_th: 'นาย',
        changed_by_first_name: 'สมชาย',
        changed_by_last_name: 'เจ้าหน้าที่',
        changed_at: '2026-06-26T22:10:36.944Z',
      },
      {
        id: 3,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
        note: 'ตั้งค่าอุปกรณ์และทดสอบแล้ว',
        changed_by: 4,
        changed_by_username: 'operator_demo',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-26T23:07:18.191Z',
      },
      {
        id: 4,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        note: 'ตรวจสอบแล้ว',
        changed_by: 7,
        changed_by_username: 'officer_demo',
        changed_by_prename_th: 'นาย',
        changed_by_first_name: 'สมชาย',
        changed_by_last_name: 'เจ้าหน้าที่',
        changed_at: '2026-06-27T03:07:36.983Z',
      },
    ]);

    expect(timeline.statusHistory).toMatchObject([
      {
        changedById: 4,
        changedBy: 'operator_demo',
        endedAt: '2026-06-26T22:10:36.944Z',
        durationDays: 1,
        durationText: '1 วัน',
        isTerminal: false,
      },
      {
        changedById: 7,
        changedBy: 'นายสมชาย เจ้าหน้าที่',
        durationDays: 1,
        durationText: '1 วัน',
        isTerminal: false,
      },
      {
        changedById: 4,
        changedBy: 'operator_demo',
        endedAt: '2026-06-27T03:07:36.983Z',
        durationDays: 2,
        durationText: '2 วัน',
        isTerminal: false,
      },
      {
        changedById: 7,
        changedBy: 'นายสมชาย เจ้าหน้าที่',
        endedAt: '2026-06-27T03:07:36.983Z',
        durationDays: 1,
        durationText: '1 วัน',
        isTerminal: true,
      },
    ]);
    expect(timeline.statusDurationSummary).toEqual({
      startedAt: '2026-06-26T22:01:35.536Z',
      startDate: '2026-06-26',
      startStatus: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
      startStatusLabel: 'รอพิจารณาแบบ',
      endedAt: '2026-06-27T03:07:36.983Z',
      endDate: '2026-06-27',
      endStatus: CONNECTION_REQUEST_STATUS.CONNECTED,
      endStatusLabel: 'เชื่อมต่อแล้ว',
      isTerminal: true,
      terminalStatuses: [CONNECTION_REQUEST_STATUS.CONNECTED, CONNECTION_REQUEST_STATUS.CANCELED],
      totalDurationDays: 2,
      totalDurationText: '2 วัน',
    });
  });

  it('stops status duration summaries when requests are canceled', () => {
    const timeline = buildStatusHistoryTimelineForTests([
      {
        id: 1,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        note: 'ผู้ประกอบการส่งฟอร์ม',
        changed_by: 4,
        changed_by_username: null,
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-26T09:00:00.000Z',
      },
      {
        id: 2,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.CANCELED,
        note: 'ผู้ประกอบการยกเลิกคำขอ',
        changed_by: 4,
        changed_by_username: null,
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-27T10:30:00.000Z',
      },
    ]);

    expect(timeline.statusHistory.at(-1)).toMatchObject({
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      statusLabel: 'ยกเลิก',
      changedBy: 'User #4',
      isTerminal: true,
      durationDays: 1,
      durationText: '1 วัน',
    });
    expect(timeline.statusDurationSummary).toMatchObject({
      endStatus: CONNECTION_REQUEST_STATUS.CANCELED,
      endStatusLabel: 'ยกเลิก',
      isTerminal: true,
      totalDurationDays: 2,
      totalDurationText: '2 วัน',
    });
  });

  it('does not close the total duration while the latest status is not terminal', () => {
    const timeline = buildStatusHistoryTimelineForTests([
      {
        id: 1,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        note: 'ผู้ประกอบการส่งฟอร์ม',
        changed_by: 4,
        changed_by_username: 'operator_demo',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-26T09:00:00.000Z',
      },
      {
        id: 2,
        request_id: 10,
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        note: 'อนุมัติแบบแล้ว',
        changed_by: 7,
        changed_by_username: 'officer_demo',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-06-27T14:00:00.000Z',
      },
    ]);

    expect(timeline.statusHistory.at(-1)).toMatchObject({
      status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      endedAt: null,
      durationDays: null,
      durationText: null,
      isTerminal: false,
    });
    expect(timeline.statusDurationSummary).toMatchObject({
      endedAt: null,
      endDate: null,
      endStatus: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      isTerminal: false,
      totalDurationDays: null,
      totalDurationText: null,
    });
  });
});
