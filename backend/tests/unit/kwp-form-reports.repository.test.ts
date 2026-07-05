import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormFactoryQueryForTests,
  buildKwpFormRequestQueryForTests,
  toKwpFormRequestDTOForTests,
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
    expect(compiled.bindings).toEqual(expect.arrayContaining(['KWP03', 'UNDER_REVIEW', 'ภาคกลาง']));
  });

  it('limits operator request rows to assigned juristics', () => {
    const sql = buildKwpFormRequestQueryForTests({}, { actorUserId: 42, scope: 'OWN_FACTORY' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
  });

  it('labels resubmitted returned requests as edited and waiting for review', () => {
    const row = toKwpFormRequestDTOForTests(
      {
        id: 12,
        submission_no: 'KWP-69-00012',
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
  });
});
