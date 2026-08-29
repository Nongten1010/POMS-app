import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormFactoryQueryForTests,
  buildKwpFormRequestQueryForTests,
  toKwpFormFactoryDTOForTests,
  toKwpFormRequestDTOForTests,
  toKwpFormStatusHistoryDTOForTests,
} from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';

describe('kwpFormReportsRepository access filters', () => {
  it.each([
    ['operator', { actorUserId: 42, scope: 'OWN_FACTORY' as const }],
    ['officer', { actorUserId: 77, scope: 'ALL' as const }],
  ])('uses the current live POMS factory name for the %s factory table', (_role, access) => {
    const sql = buildKwpFormFactoryQueryForTests(access).toSQL().sql.toLowerCase();

    expect(sql).toContain('select top (1) cp_name.factory_name');
    expect(sql).toContain('cp_name.eligible_factory_id = ef.id');
    expect(sql).toContain('cp_name.deleted_at is null');
    expect(sql).toContain('order by cp_name.updated_at desc, cp_name.id desc');
    expect(sql).toMatch(/group by .*\[ef\]\.\[factory_name\]/);
    expect(sql).not.toContain('[f].[name] as [factory_name]');
  });

  it('builds factory table data from current connected points and limits operators to assigned juristics', () => {
    const sql = buildKwpFormFactoryQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toMatch(/outer apply\s*\(\s*select top \(1\) ef_source\.\*/);
    expect(sql).toContain('from eligible_factories as ef_source');
    expect(sql).toContain('order by case');
    expect(sql).toContain('inner join [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).toContain('[cp].[eligible_factory_id] = [ef].[id]');
    expect(sql).not.toContain('from [cems_wpms_connection_requests] as [cr]');
    expect(sql).toContain(
      'coalesce(ef.factory_registration_no_new, f.fid) as factory_registration_no_new',
    );
    expect(sql).toContain('coalesce(ef.province_name, p.name_th) as province_name');
    expect(sql).toContain('[ef].[business_activity]');
    expect(sql).toContain('[ef].[factory_type_sequence]');
    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
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

  it('filters ERC factory and request tables by factory type 88', () => {
    const factories = buildKwpFormFactoryQueryForTests({
      actorUserId: 88,
      scope: { scope: 'FACTORY_TYPE_88' },
    }).toSQL();
    const requests = buildKwpFormRequestQueryForTests({}, {
      actorUserId: 88,
      scope: { scope: 'FACTORY_TYPE_88' },
    }).toSQL();

    expect(factories.sql.toLowerCase()).toContain('[ef].[factory_type_sequence]');
    expect(factories.bindings).toContain('00088');
    expect(requests.sql.toLowerCase()).toContain('eligible_factories');
    expect(requests.sql.toLowerCase()).toContain('[ef].[factory_type_sequence]');
    expect(requests.bindings).toContain('00088');
  });

  it('filters province-scoped factory rows to the selected province', () => {
    const compiled = buildKwpFormFactoryQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_PROVINCE', province: 'สระบุรี' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[name_th] = ?');
    expect(compiled.bindings).toContain('สระบุรี');
  });

  it('fails closed for province-scoped factory rows when the selected province is missing', () => {
    const compiled = buildKwpFormFactoryQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_PROVINCE', province: null },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = ?');
    expect(compiled.bindings).toContain(0);
  });

  it('fails closed for industrial-estate-scoped factory rows without estate details in the auth payload', () => {
    const compiled = buildKwpFormFactoryQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_ESTATE' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = ?');
    expect(compiled.bindings).toContain(0);
  });

  it('supports an industrial-estate id when no estate code is present', () => {
    const compiled = buildKwpFormFactoryQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_ESTATE', estateId: 19 } as never,
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[ie].[id] = ?');
    expect(compiled.bindings).toContain(19);
  });

  it('keeps request rows broad when scope is ALL even if regional access exists', () => {
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
    expect(sql).toMatch(/outer apply\s*\(\s*select top \(1\) ef_source\.\*/);
    expect(sql).toMatch(/outer apply\s*\(\s*select top \(1\) f_source\.\*/);
    expect(sql).toContain(
      'coalesce([s].[submission_region_name], [p].[region]) as [province_region]',
    );
    expect(sql).not.toContain('coalesce([s].[submission_region_name], [p].[region]) in (?)');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['KWP03', 'UNDER_REVIEW']));
  });

  it('filters request rows by assigned regions only for IN_REGION scope', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      { formType: 'KWP03', status: 'UNDER_REVIEW' },
      {
        actorUserId: 77,
        scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
        regionalAccess: { regions: ['ภาคกลาง'] },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('where [s].[deleted_at] is null');
    expect(sql).toContain('[p].[region] in (?)');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['KWP03', 'UNDER_REVIEW', 'ภาคกลาง']));
  });

  it('fails closed when the explicit scope region is outside assigned profile regions', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: { scope: 'IN_REGION', region: 'ภาคใต้' },
        regionalAccess: { regions: ['ภาคกลาง', 'ภาคเหนือ'] },
      },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = ?');
    expect(compiled.bindings).toContain(0);
    expect(compiled.bindings).not.toContain('ภาคใต้');
    expect(compiled.bindings).not.toContain('ภาคกลาง');
    expect(compiled.bindings).not.toContain('ภาคเหนือ');
  });

  it('fails closed when IN_REGION has no assigned profile region', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
        regionalAccess: null,
      },
    ).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = ?');
    expect(compiled.bindings).toContain(0);
    expect(compiled.bindings).not.toContain('ภาคกลาง');
  });

  it('filters industrial-estate-scoped request rows by estateCode before legacy estate keys', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: {
          scope: 'IN_ESTATE',
          estate: 'LEGACY-ESTATE',
          estateCode: 'ESTATE-01',
        } as never,
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[ie].[code] = ?');
    expect(compiled.bindings).toContain('ESTATE-01');
    expect(compiled.bindings).not.toContain('LEGACY-ESTATE');
  });

  it('limits operator request rows to assigned juristics', () => {
    const sql = buildKwpFormRequestQueryForTests({}, { actorUserId: 42, scope: 'OWN_FACTORY' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('user_juristics');
    expect(sql).toContain('user_factory_access');
    expect(sql).toContain('[uj].[user_id]');
  });

  it('filters request rows by every supported current and legacy factory identifier', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      { factoryId: '10840002225552' },
      { actorUserId: 77, scope: 'ALL' },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[s].[factory_id] = ?');
    expect(sql).toContain('[s].[factory_registration_no] = ?');
    expect(sql).toContain('[cp].[factory_id] = ?');
    expect(sql).toContain('[cp].[factory_registration_no] = ?');
    expect(sql).toContain('[ef].[source_factory_id] = ?');
    expect(sql).toContain('[ef].[factory_registration_no_new] = ?');
    expect(sql).toContain('[ef].[factory_registration_no_old] = ?');
    expect(sql).toContain('[f].[fid] = ?');
    expect(sql).toContain('[f].[code] = ?');
    expect(compiled.bindings).toEqual(Array(9).fill('10840002225552'));
  });

  it('filters province-scoped request rows to the selected province', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: { scope: 'IN_PROVINCE', province: 'สระบุรี' },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[p].[name_th] = ?');
    expect(compiled.bindings).toContain('สระบุรี');
  });

  it('fails closed for industrial-estate-scoped request rows without estate details in the auth payload', () => {
    const compiled = buildKwpFormRequestQueryForTests(
      {},
      {
        actorUserId: 77,
        scope: { scope: 'IN_ESTATE' },
      },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = ?');
    expect(compiled.bindings).toContain(0);
  });

  it('labels resubmitted returned requests as edited and waiting for review', () => {
    const row = toKwpFormRequestDTOForTests(
      {
        id: 12,
        submission_no: 'F01-07-0001/2569',
        form_type: 'KWP01',
        status: 'SUBMITTED',
        factory_id: 'FID-001',
        factory_name: 'บริษัท ทดสอบ จำกัด',
        factory_registration_no: '10190000225448',
        factory_address: '9 หมู่ 9',
        industry_type: '10100 / 3',
        connected_point_id: 8,
        point_code: 'S0001',
        point_name: 'ปล่องระบาย A',
        point_type: 'STACK',
        submitted_at: '2026-07-04T10:30:00.000Z',
        reviewed_at: '2026-07-04T09:00:00.000Z',
        officer_note: 'เพิ่มเอกสารแนบผลตรวจวัด',
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T10:30:00.000Z',
        province_name: 'สระบุรี',
        province_region: 'ภาคกลาง',
        system_type: 'CEMS',
      },
      [
        {
          id: 1,
          status: 'SUBMITTED',
          statusLabel: 'รอพิจารณา',
          note: null,
          changedById: 42,
          changedBy: 'operator',
          changedAt: '2026-07-04T08:00:00.000Z',
          changedDate: '04/07/2569',
        },
        {
          id: 2,
          status: 'REVISION_REQUESTED',
          statusLabel: 'รอโรงงานแก้ไข',
          note: 'เพิ่มเอกสารแนบผลตรวจวัด',
          changedById: 77,
          changedBy: 'officer',
          changedAt: '2026-07-04T09:00:00.000Z',
          changedDate: '04/07/2569',
        },
        {
          id: 3,
          status: 'SUBMITTED',
          statusLabel: 'แก้ไขแล้ว/รอพิจารณา',
          note: 'ปรับข้อมูลและแนบเอกสารครบแล้ว',
          changedById: 42,
          changedBy: 'operator',
          changedAt: '2026-07-04T10:30:00.000Z',
          changedDate: '04/07/2569',
        },
      ],
    );

    expect(row.status).toBe('แก้ไขแล้ว/รอพิจารณา');
    expect(row.requestNo).toBe('F01-07-0001/2569');
  });

  it('maps the canonical factory-table registration and current location fields', () => {
    const row = toKwpFormFactoryDTOForTests({
      factory_id: '31',
      factory_fid: '10840002225552',
      factory_registration_no_new: '10840002225552',
      factory_name: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
      factory_system_detail: null,
      province_name: 'สุราษฎร์ธานี',
      province_region: 'ภาคใต้',
      old_registration_no: '3-7(1)-22/55สฎ',
      eligible_address: null,
      eligible_business_activity: null,
      eligible_factory_type_sequence: null,
      connected_point_count: null,
    });

    expect(row).toEqual({
      id: '10840002225552',
      factoryId: '10840002225552',
      factoryName: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
      newRegistrationNo: '10840002225552',
      oldRegistrationNo: '3-7(1)-22/55สฎ',
      industryType: null,
      industryMainOrder: null,
      businessActivity: null,
      province: 'สุราษฎร์ธานี',
      address: null,
      monitoringPointCount: 0,
    });
  });

  it('maps status-history actor names with full-name and username fallbacks', () => {
    expect(
      toKwpFormStatusHistoryDTOForTests({
        id: 2,
        submission_id: 13,
        status: 'REVISION_REQUESTED',
        note: 'แก้เลขทะเบียน',
        changed_by: 77,
        changed_by_username: 'officer',
        changed_by_prename_th: 'นาย',
        changed_by_first_name: 'ทดสอบ',
        changed_by_last_name: 'ระบบ',
        changed_at: '2026-07-04T09:00:00.000Z',
      }),
    ).toMatchObject({
      id: 2,
      changedById: 77,
      changedBy: 'นาย ทดสอบ ระบบ',
      changedAt: '2026-07-04T09:00:00.000Z',
      changedDate: '04/07/2569',
    });

    expect(
      toKwpFormStatusHistoryDTOForTests({
        id: 3,
        submission_id: 13,
        status: 'SUBMITTED',
        note: null,
        changed_by: null,
        changed_by_username: 'system',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-07-04T10:00:00.000Z',
      }),
    ).toMatchObject({ changedById: null, changedBy: 'system' });
  });

  it('resolves the highlighted legacy registration snapshot to one current factory identity', () => {
    const row = toKwpFormRequestDTOForTests(
      {
        id: 13,
        submission_no: 'F01-07-0002/2569',
        form_type: 'KWP01',
        status: 'SUBMITTED',
        factory_id: '10840002225552',
        factory_name: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
        factory_registration_no: '3-7(1)-22/55สฎ',
        factory_address: null,
        industry_type: null,
        connected_point_id: 9,
        point_code: 'S1114',
        point_name: null,
        point_type: 'STACK',
        submitted_at: '2026-07-04T08:00:00.000Z',
        reviewed_at: null,
        officer_note: null,
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T08:00:00.000Z',
        province_name: 'กรุงเทพมหานคร',
        province_region: 'ภาคกลาง',
        system_type: 'CEMS',
        current_factory_name: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
        current_factory_registration_no: '10840002225552',
        old_registration_no: '3-7(1)-22/55สฎ',
        current_province_name: 'สุราษฎร์ธานี',
      } as never,
      [],
    );

    expect(row).toMatchObject({
      factoryName: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
      factoryRegistration: '10840002225552',
      oldRegistrationNo: '3-7(1)-22/55สฎ',
      province: 'สุราษฎร์ธานี',
      monitoringPointCode: 'S1114',
      requestNo: 'F01-07-0002/2569',
    });
  });

  it('keeps the stored snapshot as a fallback when no current identity can be resolved', () => {
    const row = toKwpFormRequestDTOForTests(
      {
        id: 14,
        submission_no: 'F01-07-0003/2569',
        form_type: 'KWP01',
        status: 'SUBMITTED',
        factory_id: 'LEGACY-001',
        factory_name: 'โรงงานเดิม',
        factory_registration_no: 'LEGACY-REG',
        factory_address: null,
        industry_type: null,
        connected_point_id: null,
        point_code: null,
        point_name: null,
        point_type: null,
        submitted_at: '2026-07-04T08:00:00.000Z',
        reviewed_at: null,
        officer_note: null,
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T08:00:00.000Z',
        province_name: null,
        province_region: null,
        system_type: null,
        current_factory_name: null,
        current_factory_registration_no: null,
        old_registration_no: null,
        current_province_name: null,
      } as never,
      [],
    );

    expect(row).toMatchObject({
      factoryName: 'โรงงานเดิม',
      factoryRegistration: 'LEGACY-REG',
      oldRegistrationNo: null,
      province: null,
    });
  });

  it('ranks one eligible factory match and recognizes an old registration snapshot', () => {
    const sql = buildKwpFormRequestQueryForTests({}, { actorUserId: 77, scope: 'ALL' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toMatch(/outer apply\s*\(\s*select top \(1\) ef_source\.\*/);
    expect(sql).toContain('ef_source.id = cp.eligible_factory_id');
    expect(sql).toContain('ef_source.factory_registration_no_old = s.factory_registration_no');
    expect(sql).toContain('order by case');
    expect(sql).not.toContain('left join [eligible_factories] as [ef]');
    expect(sql).toContain(
      'coalesce(ef.factory_registration_no_new, f.fid, cp.factory_registration_no, s.factory_registration_no) as current_factory_registration_no',
    );
    expect(sql).toContain('coalesce(ef.province_name, p.name_th) as current_province_name');
  });
});
