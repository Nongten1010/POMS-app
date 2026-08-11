import { describe, expect, it } from '@jest/globals';
import {
  buildStatusHistoryNoteForTests,
  buildStatusHistoryTimelineForTests,
  buildBaseQueryForTests,
  buildDuplicateActiveMeasurementPointCleanupSqlForTests,
  buildDirectConnectionFactoryQueryForTests,
  buildConnectedFactoriesForAccessQueryForTests,
  buildConnectedFactoryGeneralForAccessQueryForTests,
  buildConnectedMeasurementPointsQueryForTests,
  buildCurrentPomsFactoryNamesQueryForTests,
  buildFactoriesForAccessQueryForTests,
  buildRequestNoForTests,
  shouldIssueWaitingConnectionSideEffectsForTests,
  toRequestRowForTests,
} from '../../src/modules/connection-requests/connection-requests.repository';
import { CONNECTION_REQUEST_STATUS } from '../../src/modules/connection-requests/connection-requests.types';

describe('connectionRequestsRepository query helpers', () => {
  it('stores province in the request address while retaining the province snapshot input', () => {
    const row = toRequestRowForTests({
      factoryId: '72120200125358',
      factoryName: 'โรงงานตัวอย่าง',
      factoryRegistrationNo: '72120200125358',
      address: '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน 13160',
      provinceName: 'พระนครศรีอยุธยา',
      systemType: 'CEMS',
      contactName: 'ผู้ประสานงาน',
      contactPhone: '0812345678',
      measurementPoints: [],
    });

    expect(row.address).toBe('89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160');
  });

  it('sources connected dashboard factories from active POMS points without requiring a factory master row', () => {
    const sql = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [eligible_factories] as [ef]');
    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).toContain('cp.eligible_factory_id = ef.id');
    expect(sql).toContain('[cp].[deleted_at] is null');
    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('coalesce(f.fid, ef.factory_registration_no_new) as fid');
  });

  it('keeps connected dashboard factories fail-closed for OWN_FACTORY access', () => {
    const compiled = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('ufa.factory_id = f.id');
    expect(compiled.bindings.filter((binding: unknown) => binding === 42)).toHaveLength(2);
  });

  it('filters connected dashboard factories by eligible-factory location', () => {
    const compiled = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'นนทบุรี',
      },
      regionalAccess: { regions: ['ภาคกลาง'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[name_th] = [ef].[province_name]');
    expect(sql).toContain('[p].[region]');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['นนทบุรี', 'ภาคกลาง']));
  });

  it('resolves connected factory detail from eligible data when no factory master row exists', () => {
    const compiled = buildConnectedFactoryGeneralForAccessQueryForTests('40100007125560', {
      actorUserId: 42,
      scope: 'ALL',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [eligible_factories] as [ef]');
    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).toContain('cp.eligible_factory_id = ef.id');
    expect(sql).toContain('[ef].[source_factory_id]');
    expect(sql).toContain('[ef].[factory_registration_no_new]');
    expect(sql).toContain('[ef].[factory_registration_no_old]');
    expect(compiled.bindings).toEqual(
      expect.arrayContaining(['40100007125560', '40100007125560', '40100007125560']),
    );
  });

  it('loads connected points by eligible factory id when the stored factory id is an old alias', () => {
    const compiled = buildConnectedMeasurementPointsQueryForTests(['40100007125560'], [17]).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[factory_id] in (?)');
    expect(sql).toContain('or [eligible_factory_id] in (?)');
    expect(sql).toContain('[deleted_at] is null');
    expect(compiled.bindings).toEqual(['40100007125560', 17]);
  });

  it('resolves direct connections from active eligible factories without requiring a POMS factory row', () => {
    const compiled = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '3-34(3)-3/54นบ' },
      { actorUserId: 42, scope: 'ALL' },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [eligible_factories] as [ef]');
    expect(sql).not.toContain('from [factories] as [f]');
    expect(sql).toContain('[ef].[factory_name]');
    expect(sql).toContain('[ef].[factory_registration_no_old]');
    expect(sql).toContain('[ef].[deleted_at] is null');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['10120000325542', '3-34(3)-3/54นบ']));
  });

  it('applies the officer region to the eligible-factory location for direct connections', () => {
    const compiled = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '10120000325542' },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: 'ภาคกลาง', province: null },
        regionalAccess: { regions: ['ภาคกลาง'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(compiled.bindings.filter((binding: unknown) => binding === 'ภาคกลาง')).toHaveLength(2);
  });

  it('uses regional access for IN_REGION direct connections when the scope omits region details', () => {
    const compiled = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '10120000325542' },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: null, province: null },
        regionalAccess: { regions: ['ภาคกลาง'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(sql).not.toContain('1 = 0');
    expect(compiled.bindings).toContain('ภาคกลาง');
  });

  it('denies a direct connection scope that cannot be evaluated against eligible factories', () => {
    const sql = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '10120000325542' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    )
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('1 = 0');
  });

  it('applies a province-scoped direct connection to eligible factory province data', () => {
    const compiled = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '10120000325542' },
      {
        actorUserId: 42,
        scope: { scope: 'IN_PROVINCE', region: null, province: 'นนทบุรี' },
      },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[ef].[province_name]');
    expect(compiled.bindings).toContain('นนทบุรี');
  });

  it('denies a location scope that omits its required location value', () => {
    const sql = buildDirectConnectionFactoryQueryForTests(
      { factoryId: '10120000325542', factoryRegistrationNo: '10120000325542' },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: null, province: null },
      },
    )
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('1 = 0');
  });

  it('formats request numbers with a four-digit sequence and full Buddhist year', () => {
    const date = new Date('2026-05-30T12:00:00.000+07:00');

    expect(buildRequestNoForTests('CEMS', 1, date)).toBe('CEMS-0001/2569');
    expect(buildRequestNoForTests('WPMS', 3, date)).toBe('WEMS-0003/2569');
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

  it('does not let regional access narrow an ALL-scoped request list', () => {
    const compiled = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).not.toContain('cems_wpms_request_factory_snapshots');
    expect(sql).not.toContain('[fs].[region_name]');
    expect(compiled.bindings).not.toContain('ภาคตะวันออก');
  });

  it('uses regional access for IN_REGION request lists when the scope omits region details', () => {
    const compiled = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: null, province: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('cems_wpms_request_factory_snapshots');
    expect(sql).toContain('[fs].[region_name]');
    expect(sql).not.toContain('[created_by] = ?');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('fails closed when explicit request region conflicts with the assigned regional access', () => {
    const compiled = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION', region: 'ภาคเหนือ', province: null },
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = 0');
    expect(sql).not.toContain('[created_by] = ?');
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

  it('authorizes OWN_FACTORY request access through assigned factories instead of request ownership', () => {
    const compiled = buildBaseQueryForTests(
      { factoryId: '10120000325542', status: CONNECTION_REQUEST_STATUS.CONNECTED },
      { actorUserId: 42, scope: 'OWN_FACTORY', useAssignedFactoryAccess: true },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('cems_wpms_connection_requests.factory_id');
    expect(sql).not.toContain('[created_by] = ?');
    expect(compiled.bindings.filter((binding: unknown) => binding === 42)).toHaveLength(2);
  });

  it('authorizes request reads through either request ownership or assigned factory access', () => {
    const compiled = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
        useAssignedFactoryAccess: true,
        includeRequestOwnerAccess: true,
      },
    )
      .where('id', 12)
      .toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[created_by] = ?');
    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(compiled.bindings.filter((binding: unknown) => binding === 42)).toHaveLength(3);
    expect(compiled.bindings).toContain(12);
  });

  it('keeps ordinary OWN_FACTORY request lists scoped to the request creator', () => {
    const compiled = buildBaseQueryForTests(
      { factoryId: '10120000325542' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[created_by] = ?');
    expect(sql).not.toContain('user_juristics');
    expect(sql).not.toContain('user_factory_access');
    expect(compiled.bindings).toContain(42);
  });

  it('fails closed when a request province scope has no assigned province', () => {
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

    expect(sql).toContain('1 = 0');
  });

  it('preserves operator factory master rows when no eligible-factory row exists', () => {
    const sql = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toMatch(/outer apply\s*\(\s*select top \(1\)/);
    expect(sql).toContain('from eligible_factories as ef_source');
    expect(sql).toContain('ef_source.factory_registration_no_new = f.code');
    expect(sql).toContain('ef_source.source_factory_id = f.fid');
    expect(sql).toContain('ef_source.deleted_at is null');
    expect(sql).toContain('order by case');
    expect(sql).not.toContain('join [eligible_factories] as [ef]');
    expect(sql).toContain('from provinces as p_source');
    expect(sql).toContain('p_source.name_th = ef.province_name');
    expect(sql).toContain('(ef.id is null and p_source.id = f.province_id)');
    expect(sql).toContain('from industrial_estates as ie_source');
    expect(sql).toContain('ie_source.name_th = ef.industrial_estate_name');
    expect(sql).toContain('(ef.id is null and ie_source.id = f.industrial_estate_id)');
    expect(sql).toContain(
      'coalesce(ef.source_factory_id, ef.factory_registration_no_new, f.fid) as fid',
    );
    expect(sql).toContain('coalesce(ef.factory_registration_no_new, f.code) as code');
    expect(sql).toContain('select top (1) cp_name.factory_name');
    expect(sql).toContain('cp_name.eligible_factory_id = ef.id');
    expect(sql).toContain('order by cp_name.updated_at desc, cp_name.id desc');
    expect(sql).toContain('ef.factory_name,');
    expect(sql).toContain('f.name');
    expect(sql).toContain('coalesce(ef.province_name, p.name_th) as province_name');
    expect(sql).toContain('[ie].[code] as [industrial_estate_code]');
    expect(sql).toContain(
      'coalesce(ef.industrial_estate_name, ie.name_th) as industrial_estate_name',
    );
    expect(sql).toContain('coalesce(cast(f.is_active as int), 1) as is_active');
    expect(sql).toContain('[f].[system_detail]');
  });

  it('prefers the latest current POMS factory name in the connected dashboard', () => {
    const sql = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();
    const normalizedSql = sql.replace(/\s+/g, ' ');

    expect(sql).toContain('select top (1) cp_name.factory_name');
    expect(sql).toContain('cp_name.eligible_factory_id = ef.id');
    expect(sql).toContain('cp_name.deleted_at is null');
    expect(sql).toContain('order by cp_name.updated_at desc, cp_name.id desc');
    expect(normalizedSql).toContain('), ef.factory_name, f.name ) as name');
  });

  it('reads the synchronized eligible-factory industrial estate for connected POMS factories', () => {
    const sql = buildConnectedFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [eligible_factories] as [ef]');
    expect(sql).toContain('cp.eligible_factory_id = ef.id');
    expect(sql).toContain(
      'coalesce(ie.name_th, ef.industrial_estate_name) as industrial_estate_name',
    );
  });

  it('loads current POMS factory names without requiring a factory master', () => {
    const compiled = buildCurrentPomsFactoryNamesQueryForTests(['10120000325542'], [225]).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [cems_wpms_connected_measurement_points] as [cp_name]');
    expect(sql).toContain('[cp_name].[factory_id] in (?)');
    expect(sql).toContain('or [cp_name].[eligible_factory_id] in (?)');
    expect(sql).toContain('[cp_name].[deleted_at] is null');
    expect(sql).toContain('order by [cp_name].[updated_at] desc, [cp_name].[id] desc');
    expect(compiled.bindings).toEqual(['10120000325542', 225]);
  });

  it('selects eligible-factory location and industrial estate fields for advanced filters', () => {
    const sql = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from industrial_estates as ie_source');
    expect(sql).toContain(') as ie');
    expect(sql).toContain('[p].[id] as [province_id]');
    expect(sql).toContain('[p].[region] as [province_region]');
    expect(sql).toContain('[ie].[code] as [industrial_estate_code]');
    expect(sql).toContain('coalesce(ef.province_name, p.name_th) as province_name');
    expect(sql).toContain(
      'coalesce(ef.industrial_estate_name, ie.name_th) as industrial_estate_name',
    );
  });

  it('does not let regional access narrow ALL-scoped factory access', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'ALL',
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).not.toContain('[p].[region] in (?)');
    expect(compiled.bindings).not.toContain('ภาคตะวันออก');
  });

  it('uses regional access for IN_REGION factory access when the scope omits region details', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: null, province: null },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[region]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ภาคตะวันออก');
  });

  it('fails closed when explicit factory region conflicts with the assigned regional access', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคเหนือ', province: null },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = 0');
    expect(sql).not.toContain('user_juristics');
  });

  it('uses the canonical or legacy estate scope fields for request filtering', () => {
    const canonical = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_ESTATE', estateCode: 'IEAT-01' } as never,
      },
    ).toSQL();
    const legacy = buildBaseQueryForTests(
      {},
      {
        actorUserId: 42,
        scope: { scope: 'IN_ESTATE', estate: 'IEAT-02' } as never,
      },
    ).toSQL();

    expect(canonical.bindings).toContain('IEAT-01');
    expect(legacy.bindings).toContain('IEAT-02');
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

  it('fails closed when a factory province scope has no assigned province', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: null,
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = 0');
    expect(sql).not.toContain('user_juristics');
    expect(sql).not.toContain('user_factory_access');
  });

  it('allows an OWN_FACTORY operator through either juristic or direct factory access', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('ufa.factory_id = f.id');
    expect(sql).not.toContain('inner join [user_juristics]');
    expect(compiled.bindings.filter((binding) => binding === 42)).toHaveLength(2);
  });

  it('limits dashboard factory access to a selected permission region', () => {
    const compiled = buildFactoriesForAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_REGION',
        region: 'ภาคตะวันออก',
        province: null,
      },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
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
