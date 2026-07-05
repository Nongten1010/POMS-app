import { describe, expect, it } from '@jest/globals';
import { buildPublicFileUrl } from '../../src/modules/kwp-form-submissions/kwp-form-attachments.service';
import {
  buildKwpFormSubmissionDetailQueryForTests,
  buildKwpFormEditableSubmissionQueryForTests,
  buildKwpFormSubmissionFactoryAccessQueryForTests,
  buildKwpFormSubmissionWorkflowQueryForTests,
  nextKwpWorkflowStatusForTests,
  toKwp01InsertRecordsForTests,
  toKwp02InsertRecordsForTests,
  toKwp03InsertRecordsForTests,
  toKwp05InsertRecordsForTests,
  toKwpWorkflowDTOForTests,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';

describe('kwpFormSubmissionsRepository', () => {
  it('builds public file URLs from relative storage paths', () => {
    expect(
      buildPublicFileUrl(
        'https://d-poms.diw.go.th/',
        '/uploads',
        'kwp/form-attachments/2026/07/lab report.pdf',
      ),
    ).toBe('https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/lab%20report.pdf');
  });

  it('does not duplicate upload public path when stored metadata already includes it', () => {
    expect(
      buildPublicFileUrl(
        'https://d-poms.diw.go.th/',
        '/uploads',
        '/uploads/kwp/form-attachments/2026/07/lab-report.pdf',
      ),
    ).toBe('https://d-poms.diw.go.th/uploads/kwp/form-attachments/2026/07/lab-report.pdf');
  });

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

  it('limits KWP detail reads to requested submission id, supported forms, and operator factories', () => {
    const sql = buildKwpFormSubmissionDetailQueryForTests(13, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: { regions: ['ภาคตะวันออก'] },
      publicBaseUrl: 'http://d-poms.diw.go.th',
      publicPath: '/uploads',
      formType: 'KWP02',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('[s].[id] = ?');
    expect(sql).toContain('[s].[form_type] = ?');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
    expect(sql).toContain('[p].[region] in (?)');
  });

  it('limits KWP workflow reads to requested submission id, operator factories, and regional access', () => {
    const sql = buildKwpFormSubmissionWorkflowQueryForTests(12, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: { regions: ['ภาคกลาง'] },
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('[s].[id] = ?');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
    expect(sql).toContain('[p].[region] in (?)');
  });

  it('limits returned-form edits to the requested id, form type, and operator factories', () => {
    const sql = buildKwpFormEditableSubmissionQueryForTests(12, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      formType: 'KWP01',
    })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('from [kwp_form_submissions] as [s]');
    expect(sql).toContain('[s].[id] = ?');
    expect(sql).toContain('[s].[form_type] = ?');
    expect(sql).toContain('join [user_juristics] as [uj]');
    expect(sql).toContain('[uj].[user_id]');
  });

  it('maps KWP workflow state for submitted, revision, and review transitions', () => {
    const submitted = toKwpWorkflowDTOForTests({
      id: 12,
      submission_no: 'KWP-69-00012',
      form_type: 'KWP01',
      status: 'SUBMITTED',
      officer_note: null,
      reviewed_at: null,
      created_at: '2026-07-04T08:00:00.000Z',
      updated_at: '2026-07-04T08:00:00.000Z',
      province_region: 'ภาคกลาง',
    });
    const revision = toKwpWorkflowDTOForTests(
      {
        id: 12,
        submission_no: 'KWP-69-00012',
        form_type: 'KWP01',
        status: 'REVISION_REQUESTED',
        officer_note: 'เพิ่มเอกสารแนบผลตรวจวัด',
        reviewed_at: '2026-07-04T09:00:00.000Z',
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T09:00:00.000Z',
        province_region: 'ภาคกลาง',
      },
      [
        {
          status: 'SUBMITTED',
          note: null,
          changed_at: '2026-07-04T08:00:00.000Z',
        },
        {
          status: 'REVISION_REQUESTED',
          note: 'เพิ่มเอกสารแนบผลตรวจวัด',
          changed_at: '2026-07-04T09:00:00.000Z',
        },
      ],
    );
    const returnedToReview = toKwpWorkflowDTOForTests(
      {
        id: 12,
        submission_no: 'KWP-69-00012',
        form_type: 'KWP01',
        status: 'UNDER_REVIEW',
        officer_note: 'รับเรื่องแก้ไขเข้าพิจารณา',
        reviewed_at: '2026-07-04T09:00:00.000Z',
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T10:00:00.000Z',
        province_region: 'ภาคกลาง',
      },
      [
        {
          status: 'SUBMITTED',
          note: null,
          changed_at: '2026-07-04T08:00:00.000Z',
        },
        {
          status: 'REVISION_REQUESTED',
          note: 'เพิ่มเอกสารแนบผลตรวจวัด',
          changed_at: '2026-07-04T09:00:00.000Z',
        },
        {
          status: 'UNDER_REVIEW',
          note: 'รับเรื่องแก้ไขเข้าพิจารณา',
          changed_at: '2026-07-04T10:00:00.000Z',
        },
      ],
    );

    expect(submitted.currentStep).toMatchObject({ key: 'SUBMITTED', status: 'CURRENT' });
    expect(submitted.allowedActions).toEqual(['START_REVIEW', 'REQUEST_REVISION']);
    expect(nextKwpWorkflowStatusForTests('SUBMITTED', 'START_REVIEW')).toBe('UNDER_REVIEW');
    expect(nextKwpWorkflowStatusForTests('SUBMITTED', 'REQUEST_REVISION')).toBe(
      'REVISION_REQUESTED',
    );
    expect(revision.currentStep).toMatchObject({ key: 'REVISION_REQUESTED', status: 'CURRENT' });
    expect(revision.revisionReason).toBe('เพิ่มเอกสารแนบผลตรวจวัด');
    expect(revision.allowedActions).toEqual(['START_REVIEW']);
    expect(nextKwpWorkflowStatusForTests('REVISION_REQUESTED', 'START_REVIEW')).toBe(
      'UNDER_REVIEW',
    );
    expect(returnedToReview.currentStep).toMatchObject({
      key: 'OFFICER_REVIEW',
      status: 'CURRENT',
    });
    expect(returnedToReview.revisionReason).toBe('เพิ่มเอกสารแนบผลตรวจวัด');
    expect(returnedToReview.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'REVISION_REQUESTED', status: 'DONE' }),
      ]),
    );
    expect(nextKwpWorkflowStatusForTests('UNDER_REVIEW', 'APPROVE')).toBe('APPROVED');
  });

  it('maps a returned form that the operator resubmitted back to the submitted workflow state', () => {
    const resubmitted = toKwpWorkflowDTOForTests(
      {
        id: 12,
        submission_no: 'KWP-69-00012',
        form_type: 'KWP01',
        status: 'SUBMITTED',
        officer_note: 'เพิ่มเอกสารแนบผลตรวจวัด',
        reviewed_at: '2026-07-04T09:00:00.000Z',
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T10:30:00.000Z',
        province_region: 'ภาคกลาง',
      },
      [
        {
          status: 'SUBMITTED',
          note: null,
          changed_at: '2026-07-04T08:00:00.000Z',
        },
        {
          status: 'REVISION_REQUESTED',
          note: 'เพิ่มเอกสารแนบผลตรวจวัด',
          changed_at: '2026-07-04T09:00:00.000Z',
        },
        {
          status: 'SUBMITTED',
          note: 'ปรับข้อมูลและแนบเอกสารครบแล้ว',
          changed_at: '2026-07-04T10:30:00.000Z',
        },
      ],
    );

    expect(resubmitted.status).toBe('SUBMITTED');
    expect(resubmitted.revisionReason).toBe('เพิ่มเอกสารแนบผลตรวจวัด');
    expect(resubmitted.currentStep).toMatchObject({ key: 'SUBMITTED', status: 'CURRENT' });
    expect(resubmitted.allowedActions).toEqual(['START_REVIEW', 'REQUEST_REVISION']);
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

  it('maps KWP03 payload to WPMS issue report, selected options, attachments, and initial history records', () => {
    const records = toKwp03InsertRecordsForTests({
      payload: {
        factoryId: 'FID-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        factoryRegistrationNo: '10190000225448',
        factoryAddress: '9 หมู่ 9',
        industryType: '10100 / 3',
        connectedPointId: 8,
        pointCode: 'P0001',
        pointName: 'จุดระบายน้ำทิ้ง A',
        pointType: 'WATER',
        contactName: 'สมชาย ทดสอบ',
        contactPhone: '0812345678',
        contactEmail: 'operator@example.com',
        instruments: ['ค่าบีโอดี (BOD)', 'ค่าซีโอดี (COD)'],
        measurementTimes: ['Real Time', '15 นาที'],
        wastewaterSource: 'ระบบบำบัดน้ำเสียส่วนกลาง',
        receivingSource: 'คลองสาธารณะ',
        treatmentSystemType: 'ระบบตะกอนเร่ง',
        dischargePoint: 'UTM 123456, 987654',
        averageDischarge: '125.5',
        minimumDischarge: '100.25',
        maximumDischarge: '150.75',
        issueReasons: [
          'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
          'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
        ],
        reasonDetail: 'สัญญาณเครือข่ายขัดข้องและต้องเปลี่ยนอุปกรณ์ตรวจวัด',
        problemDate: '2026-07-01',
        expectedDoneDate: '2026-07-05',
        totalDays: 5,
        failedParameters: ['BOD (mg/l)', 'COD (mg/l)'],
        correctiveAction: 'เปลี่ยนอุปกรณ์และทดสอบการส่งข้อมูล WPMS',
        attachments: [
          {
            attachmentType: 'WPMS_EVIDENCE',
            originalFileName: 'wpms-evidence.pdf',
            storedFileName: '16-wpms-evidence.pdf',
            mimeType: 'application/pdf',
            fileSize: 760000,
            storagePath: '/uploads/kwp/16-wpms-evidence.pdf',
          },
        ],
        reporterName: 'สมชาย ทดสอบ',
        reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      },
      submissionNo: 'KWP-69-00016',
      actorUserId: 42,
      now: new Date('2026-07-04T08:20:00.000Z'),
    });

    expect(records.submission).toMatchObject({
      submission_no: 'KWP-69-00016',
      form_type: 'KWP03',
      status: 'SUBMITTED',
      point_code: 'P0001',
      point_type: 'WATER',
      created_by: 42,
    });
    expect(records.wpmsIssueReport).toMatchObject({
      wastewater_source: 'ระบบบำบัดน้ำเสียส่วนกลาง',
      receiving_source: 'คลองสาธารณะ',
      treatment_system_type: 'ระบบตะกอนเร่ง',
      discharge_point: 'UTM 123456, 987654',
      average_discharge: 125.5,
      minimum_discharge: 100.25,
      maximum_discharge: 150.75,
      reason_detail: 'สัญญาณเครือข่ายขัดข้องและต้องเปลี่ยนอุปกรณ์ตรวจวัด',
      problem_date: '2026-07-01',
      expected_done_date: '2026-07-05',
      total_days: 5,
      corrective_action: 'เปลี่ยนอุปกรณ์และทดสอบการส่งข้อมูล WPMS',
    });
    expect(records.selectedOptions).toEqual([
      { option_group: 'INSTRUMENT', option_value: 'ค่าบีโอดี (BOD)', sort_order: 1 },
      { option_group: 'INSTRUMENT', option_value: 'ค่าซีโอดี (COD)', sort_order: 2 },
      { option_group: 'MEASUREMENT_TIME', option_value: 'Real Time', sort_order: 1 },
      { option_group: 'MEASUREMENT_TIME', option_value: '15 นาที', sort_order: 2 },
      {
        option_group: 'ISSUE_REASON',
        option_value: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
        sort_order: 1,
      },
      {
        option_group: 'ISSUE_REASON',
        option_value: 'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
        sort_order: 2,
      },
      { option_group: 'FAILED_PARAMETER', option_value: 'BOD (mg/l)', sort_order: 1 },
      { option_group: 'FAILED_PARAMETER', option_value: 'COD (mg/l)', sort_order: 2 },
    ]);
    expect(records.attachments).toEqual([
      {
        attachment_type: 'WPMS_EVIDENCE',
        original_file_name: 'wpms-evidence.pdf',
        stored_file_name: '16-wpms-evidence.pdf',
        mime_type: 'application/pdf',
        file_size: 760000,
        storage_path: '/uploads/kwp/16-wpms-evidence.pdf',
        uploaded_at: new Date('2026-07-04T08:20:00.000Z'),
        uploaded_by: 42,
      },
    ]);
    expect(records.statusHistory).toMatchObject({
      status: 'SUBMITTED',
      changed_by: 42,
    });
  });

  it('maps KWP05 payload to calibration report, calibration items, attachments, and initial history records', () => {
    const records = toKwp05InsertRecordsForTests({
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
        businessActivity: 'ผลิตกระแสไฟฟ้า',
        samplerName: 'สมหญิง เก็บตัวอย่าง',
        officerRegistration: 'OFF-001',
        laboratoryName: 'ห้องปฏิบัติการทดสอบ จำกัด',
        laboratoryRegistration: 'LAB-REG-001',
        cemsBrand: 'CEMS Brand A',
        cemsDetail: 'CEMS Brand A รุ่น Model X',
        reportRound: '1',
        reportYear: '2569',
        calibrationItems: [
          {
            parameter: 'NOx (ppm)',
            startDate: '2026-07-01',
            endDate: '2026-07-02',
            result: 'ผ่าน',
            verifierCompany: 'บริษัท สอบเทียบ จำกัด',
            cemsModel: 'Model X',
            rataReportLink: 'https://example.com/rata-nox',
            calibrationPhotoLink: 'https://example.com/photo-nox',
            attachments: [
              {
                attachmentType: 'RATA_REPORT',
                originalFileName: 'rata-report.pdf',
                storedFileName: '15-rata-report.pdf',
                mimeType: 'application/pdf',
                fileSize: 840000,
                storagePath: '/uploads/kwp/15-rata-report.pdf',
              },
            ],
          },
          {
            parameter: 'SO2 (ppm)',
            startDate: '2026-07-03',
            endDate: '2026-07-04',
            result: 'ไม่ผ่าน',
            verifierCompany: 'บริษัท สอบเทียบ จำกัด',
            cemsModel: 'Model Y',
            rataReportLink: null,
            calibrationPhotoLink: null,
            attachments: [],
          },
        ],
        reporterName: 'สมชาย ทดสอบ',
        reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      },
      submissionNo: 'KWP-69-00015',
      actorUserId: 42,
      now: new Date('2026-07-04T08:45:00.000Z'),
    });

    expect(records.submission).toMatchObject({
      submission_no: 'KWP-69-00015',
      form_type: 'KWP05',
      status: 'SUBMITTED',
      point_code: 'S0001',
      created_by: 42,
    });
    expect(records.calibrationReport).toMatchObject({
      business_activity: 'ผลิตกระแสไฟฟ้า',
      sampler_name: 'สมหญิง เก็บตัวอย่าง',
      laboratory_name: 'ห้องปฏิบัติการทดสอบ จำกัด',
      cems_brand: 'CEMS Brand A',
      report_round: '1',
      report_year: '2569',
    });
    expect(records.calibrationItems).toEqual([
      {
        parameter_name: 'NOx (ppm)',
        start_date: '2026-07-01',
        end_date: '2026-07-02',
        result: 'ผ่าน',
        verifier_company: 'บริษัท สอบเทียบ จำกัด',
        cems_model: 'Model X',
        link_qr1: 'https://example.com/rata-nox',
        link_qr2: 'https://example.com/photo-nox',
        sort_order: 1,
      },
      {
        parameter_name: 'SO2 (ppm)',
        start_date: '2026-07-03',
        end_date: '2026-07-04',
        result: 'ไม่ผ่าน',
        verifier_company: 'บริษัท สอบเทียบ จำกัด',
        cems_model: 'Model Y',
        link_qr1: null,
        link_qr2: null,
        sort_order: 2,
      },
    ]);
    expect(records.attachmentsByItemIndex.get(0)).toEqual([
      {
        attachment_type: 'RATA_REPORT',
        original_file_name: 'rata-report.pdf',
        stored_file_name: '15-rata-report.pdf',
        mime_type: 'application/pdf',
        file_size: 840000,
        storage_path: '/uploads/kwp/15-rata-report.pdf',
        uploaded_at: new Date('2026-07-04T08:45:00.000Z'),
        uploaded_by: 42,
      },
    ]);
    expect(records.statusHistory).toMatchObject({
      status: 'SUBMITTED',
      changed_by: 42,
    });
  });
});
