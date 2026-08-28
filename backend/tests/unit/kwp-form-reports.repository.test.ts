import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormFactoryQueryForTests,
  buildKwpFormRequestQueryForTests,
  toKwpFormRequestDTOForTests,
} from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';

describe('kwpFormReportsRepository access filters', () => {
  it.each([
    ['operator', { actorUserId: 42, scope: 'OWN_FACTORY' as const }],
    ['officer', { actorUserId: 77, scope: 'ALL' as const }],
  ])('uses the current live POMS factory name for the %s factory table', (_role, access) => {
    const sql = buildKwpFormFactoryQueryForTests(access).toSQL().sql.toLowerCase();

    expect(sql).toContain('select top (1) cp_name.factory_name');
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
    expect(sql).toContain('left join [eligible_factories] as [ef]');
    expect(sql).toContain('inner join [cems_wpms_connected_measurement_points] as [cp]');
    expect(sql).not.toContain('from [cems_wpms_connection_requests] as [cr]');
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
    expect(sql).toContain('left join [factories] as [f]');
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
});
