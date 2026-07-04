import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormSubmissionFactoryAccessQueryForTests,
  toKwp01InsertRecordsForTests,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';

describe('kwpFormSubmissionsRepository', () => {
  it('limits OWN_FACTORY submission creation to factories assigned to the operator', () => {
    const sql = buildKwpFormSubmissionFactoryAccessQueryForTests('FID-001', {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
    expect(sql).toContain('[f].[fid]');
    expect(sql).toContain('[f].[code]');
  });

  it('maps KWP01 payload to submission, issue report, parameters, and initial history records', () => {
    const records = toKwp01InsertRecordsForTests({
      payload: {
        factoryId: 'FID-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        factoryRegistrationNo: '10190000225448',
        factoryAddress: '9 หมู่ 9',
        industryType: '10100 / 3',
        connectedPointId: 8,
        pointCode: 'S0001',
        pointName: 'ปล่องระบาย A',
        pointType: 'STACK',
        productionStack: 'ปล่อง A',
        primaryFuel: 'ก๊าซธรรมชาติ',
        secondaryFuel: null,
        combustionSystem: 'ระบบปิด',
        productionCapacity: '100',
        productionCapacityUnit: 'ตัน/วัน',
        contactName: 'สมชาย ทดสอบ',
        contactPhone: '0812345678',
        contactEmail: 'operator@example.com',
        issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
        reasonDetail: 'เครื่องวิเคราะห์ก๊าซไม่สามารถส่งข้อมูลได้',
        problemDate: '2026-07-01',
        expectedDoneDate: '2026-07-05',
        totalDays: 5,
        unreportedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
        correctiveAction: 'ซ่อมบำรุงเครื่องมือ',
        reporterName: 'สมชาย ทดสอบ',
        reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      },
      submissionNo: 'KWP-69-00012',
      actorUserId: 42,
      now: new Date('2026-07-04T08:00:00.000Z'),
    });

    expect(records.submission).toMatchObject({
      submission_no: 'KWP-69-00012',
      form_type: 'KWP01',
      status: 'SUBMITTED',
      factory_name: 'บริษัท ทดสอบ จำกัด',
      submitted_at: new Date('2026-07-04T08:00:00.000Z'),
      created_by: 42,
    });
    expect(records.issueReport).toMatchObject({
      issue_reason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
      total_days: 5,
    });
    expect(records.unreportedParameters).toEqual([
      { parameter_name: 'NOx (ppm)', sort_order: 1 },
      { parameter_name: 'SO2 (ppm)', sort_order: 2 },
    ]);
    expect(records.statusHistory).toMatchObject({
      status: 'SUBMITTED',
      changed_by: 42,
      changed_at: new Date('2026-07-04T08:00:00.000Z'),
    });
  });
});
