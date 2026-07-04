import { describe, expect, it } from '@jest/globals';
import {
  buildKwpFormSubmissionFactoryAccessQueryForTests,
  toKwp01InsertRecordsForTests,
  toKwp02InsertRecordsForTests,
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

  it('maps KWP02 payload to submission, emission measurement items, attachments, and initial history records', () => {
    const records = toKwp02InsertRecordsForTests({
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
        measurementItems: [
          {
            pollutant: 'NOx (ppm)',
            sampleDate: '2026-07-01',
            measuredValue: '110.25',
            unit: 'ppm',
            laboratoryNo: 'LAB-001',
            reportNo: 'RPT-001',
            method: 'USEPA Method 7E',
            attachments: [
              {
                attachmentType: 'SAMPLING_PHOTO',
                originalFileName: 'sampling-photo.jpg',
                storedFileName: '13-sampling-photo.jpg',
                mimeType: 'image/jpeg',
                fileSize: 120000,
                storagePath: '/uploads/kwp/13-sampling-photo.jpg',
              },
            ],
          },
          {
            pollutant: 'SO2 (ppm)',
            sampleDate: '2026-07-01',
            measuredValue: '<5',
            unit: 'ppm',
            laboratoryNo: 'LAB-002',
            reportNo: 'RPT-002',
            method: 'USEPA Method 6C',
            attachments: [],
          },
        ],
        reporterName: 'สมชาย ทดสอบ',
        reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      },
      submissionNo: 'KWP-69-00013',
      actorUserId: 42,
      now: new Date('2026-07-04T08:15:00.000Z'),
    });

    expect(records.submission).toMatchObject({
      submission_no: 'KWP-69-00013',
      form_type: 'KWP02',
      status: 'SUBMITTED',
      point_code: 'S0001',
      submitted_at: new Date('2026-07-04T08:15:00.000Z'),
      created_by: 42,
    });
    expect(records.measurementItems).toEqual([
      {
        pollutant: 'NOx (ppm)',
        sample_date: '2026-07-01',
        measured_value: 110.25,
        measured_value_text: '110.25',
        unit: 'ppm',
        laboratory_no: 'LAB-001',
        report_no: 'RPT-001',
        method: 'USEPA Method 7E',
        sort_order: 1,
      },
      {
        pollutant: 'SO2 (ppm)',
        sample_date: '2026-07-01',
        measured_value: null,
        measured_value_text: '<5',
        unit: 'ppm',
        laboratory_no: 'LAB-002',
        report_no: 'RPT-002',
        method: 'USEPA Method 6C',
        sort_order: 2,
      },
    ]);
    expect(records.attachmentsByItemIndex).toEqual(
      new Map([
        [
          0,
          [
            {
              attachment_type: 'SAMPLING_PHOTO',
              original_file_name: 'sampling-photo.jpg',
              stored_file_name: '13-sampling-photo.jpg',
              mime_type: 'image/jpeg',
              file_size: 120000,
              storage_path: '/uploads/kwp/13-sampling-photo.jpg',
              uploaded_at: new Date('2026-07-04T08:15:00.000Z'),
              uploaded_by: 42,
            },
          ],
        ],
      ]),
    );
    expect(records.statusHistory).toMatchObject({
      status: 'SUBMITTED',
      changed_by: 42,
    });
  });

  it('maps KWP04 payload to the shared emission measurement tables', () => {
    const records = toKwp02InsertRecordsForTests({
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
        measurementItems: [
          {
            pollutant: 'CO (ppm)',
            sampleDate: '2026-07-02',
            measuredValue: '12.5',
            unit: 'ppm',
            laboratoryNo: 'LAB-004',
            reportNo: 'RPT-004',
            method: 'USEPA Method 10',
            attachments: [
              {
                attachmentType: 'LAB_REPORT',
                originalFileName: 'kwp04-lab-report.pdf',
                storedFileName: '14-kwp04-lab-report.pdf',
                mimeType: 'application/pdf',
                fileSize: 940000,
                storagePath: '/uploads/kwp/14-kwp04-lab-report.pdf',
              },
            ],
          },
        ],
        reporterName: 'สมชาย ทดสอบ',
        reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      },
      submissionNo: 'KWP-69-00014',
      actorUserId: 42,
      now: new Date('2026-07-04T08:30:00.000Z'),
      formType: 'KWP04',
    });

    expect(records.submission).toMatchObject({
      submission_no: 'KWP-69-00014',
      form_type: 'KWP04',
      status: 'SUBMITTED',
      point_code: 'S0001',
    });
    expect(records.measurementItems).toEqual([
      {
        pollutant: 'CO (ppm)',
        sample_date: '2026-07-02',
        measured_value: 12.5,
        measured_value_text: '12.5',
        unit: 'ppm',
        laboratory_no: 'LAB-004',
        report_no: 'RPT-004',
        method: 'USEPA Method 10',
        sort_order: 1,
      },
    ]);
    expect(records.attachmentsByItemIndex.get(0)).toEqual([
      expect.objectContaining({
        attachment_type: 'LAB_REPORT',
        original_file_name: 'kwp04-lab-report.pdf',
        storage_path: '/uploads/kwp/14-kwp04-lab-report.pdf',
      }),
    ]);
  });
});
