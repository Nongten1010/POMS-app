import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/kwp-form-submissions/kwp-form-submissions.service', () => ({
  kwpFormSubmissionsService: {
    getById: jest.fn(),
    getWorkflow: jest.fn(),
    changeWorkflowStatus: jest.fn(),
    updateKwp01: jest.fn(),
    updateKwp02: jest.fn(),
    updateKwp03: jest.fn(),
    updateKwp04: jest.fn(),
    updateKwp05: jest.fn(),
    resubmitKwp01: jest.fn(),
    resubmitKwp02: jest.fn(),
    resubmitKwp03: jest.fn(),
    resubmitKwp04: jest.fn(),
    resubmitKwp05: jest.fn(),
    createKwp01: jest.fn(),
    createKwp02: jest.fn(),
    createKwp03: jest.fn(),
    createKwp04: jest.fn(),
    createKwp05: jest.fn(),
  },
}));

const mockSaveKwpAttachment = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../src/modules/kwp-form-submissions/kwp-form-attachments.service', () => ({
  MAX_KWP_ATTACHMENT_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  allowedKwpAttachmentFileTypes: new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['application/pdf', new Set(['.pdf'])],
  ]),
  createKwpAttachmentStorage: jest.fn(() => ({
    save: mockSaveKwpAttachment,
  })),
}));

import { createApp } from '../../src/app';
import { kwpFormSubmissionsService } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.service';

const mockedService = jest.mocked(kwpFormSubmissionsService);
const expectedPublicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://d-poms.diw.go.th';

describe('KWP form submission routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.createKwp01.mockResolvedValue({
      id: 12,
      requestNo: 'KWP-69-00012',
      form: 'กวภ.01',
      formType: 'KWP01',
      status: 'SUBMITTED',
      submittedAt: '2026-07-04T08:00:00.000Z',
    });
    mockedService.createKwp02.mockResolvedValue({
      id: 13,
      requestNo: 'KWP-69-00013',
      form: 'กวภ.02',
      formType: 'KWP02',
      status: 'SUBMITTED',
      submittedAt: '2026-07-04T08:15:00.000Z',
      measurementItemCount: 2,
      attachmentCount: 3,
    });
    mockedService.createKwp03.mockResolvedValue({
      id: 16,
      requestNo: 'KWP-69-00016',
      form: 'กวภ.03',
      formType: 'KWP03',
      status: 'SUBMITTED',
      submittedAt: '2026-07-04T08:20:00.000Z',
      attachmentCount: 2,
    });
    mockedService.createKwp04.mockResolvedValue({
      id: 14,
      requestNo: 'KWP-69-00014',
      form: 'กวภ.04',
      formType: 'KWP04',
      status: 'SUBMITTED',
      submittedAt: '2026-07-04T08:30:00.000Z',
      measurementItemCount: 2,
      attachmentCount: 3,
    });
    mockedService.createKwp05.mockResolvedValue({
      id: 15,
      requestNo: 'KWP-69-00015',
      form: 'กวภ.05',
      formType: 'KWP05',
      status: 'SUBMITTED',
      submittedAt: '2026-07-04T08:45:00.000Z',
      calibrationItemCount: 2,
      attachmentCount: 4,
    });
    mockedService.getById.mockResolvedValue(kwp02DetailResponse());
    mockedService.getWorkflow.mockResolvedValue(kwpWorkflowResponse());
    mockedService.changeWorkflowStatus.mockResolvedValue({
      ...kwpWorkflowResponse(),
      status: 'APPROVED',
      statusLabel: 'ผ่านการพิจารณา',
      currentStep: {
        key: 'SUBMITTED',
        label: 'ส่งฟอร์ม',
        status: 'DONE',
      },
      allowedActions: [],
    });
    mockedService.updateKwp01.mockResolvedValue({
      ...kwp01DetailResponse(),
      status: 'REVISION_REQUESTED',
      issueReport: {
        ...kwp01DetailResponse().issueReport,
        correctiveAction: 'แก้ไขแผนซ่อมบำรุงตามข้อสังเกตเจ้าหน้าที่',
      },
    });
    mockedService.updateKwp02.mockResolvedValue(kwp02DetailResponse());
    mockedService.updateKwp03.mockResolvedValue(kwp03DetailResponse());
    mockedService.updateKwp04.mockResolvedValue({
      ...kwp02DetailResponse(),
      id: 14,
      requestNo: 'KWP-69-00014',
      form: 'กวภ.04',
      formType: 'KWP04',
    });
    mockedService.updateKwp05.mockResolvedValue(kwp05DetailResponse());
    mockedService.resubmitKwp01.mockResolvedValue({
      ...kwpWorkflowResponse(),
      status: 'SUBMITTED',
      statusLabel: 'แก้ไขแล้ว/รอพิจารณา',
      revisionReason: 'เพิ่มเอกสารแนบผลตรวจวัด',
      allowedActions: [],
    });
    mockedService.resubmitKwp02.mockResolvedValue(kwpWorkflowResponse());
    mockedService.resubmitKwp03.mockResolvedValue(kwpWorkflowResponse());
    mockedService.resubmitKwp04.mockResolvedValue(kwpWorkflowResponse());
    mockedService.resubmitKwp05.mockResolvedValue(kwpWorkflowResponse());
    mockSaveKwpAttachment.mockResolvedValue({
      originalFileName: 'lab-report.pdf',
      storedFileName: 'mock-lab-report.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'kwp/form-attachments/2026/07/mock-lab-report.pdf',
      fileUrl: 'http://localhost:3000/uploads/kwp/form-attachments/2026/07/mock-lab-report.pdf',
    });
  });

  it('uploads a KWP attachment and returns stored file metadata', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/attachments')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'lab-report.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(mockSaveKwpAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'lab-report.pdf',
        mimeType: 'application/pdf',
        size: expect.any(Number),
      }),
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        originalFileName: 'lab-report.pdf',
        storedFileName: 'mock-lab-report.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: 'kwp/form-attachments/2026/07/mock-lab-report.pdf',
        fileUrl: 'http://localhost:3000/uploads/kwp/form-attachments/2026/07/mock-lab-report.pdf',
      },
    });
  });

  it('preserves Thai KWP attachment filenames from multipart uploads', async () => {
    const app = createApp();
    const originalFileName = 'รายงานผลการตรวจวัด_INV2026060003_(1).pdf';
    mockSaveKwpAttachment.mockResolvedValueOnce({
      originalFileName,
      storedFileName: 'mock-thai-report.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'kwp/form-attachments/2026/07/mock-thai-report.pdf',
      fileUrl: 'http://localhost:3000/uploads/kwp/form-attachments/2026/07/mock-thai-report.pdf',
    });

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/attachments')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: originalFileName,
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(mockSaveKwpAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: originalFileName,
        mimeType: 'application/pdf',
        size: expect.any(Number),
      }),
    );
    expect(response.body.data.originalFileName).toBe(originalFileName);
  });

  it('creates a submitted KWP01 form with edit permission', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp01')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(validKwp01Payload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/kwp-form-reports/requests/12');
    expect(mockedService.createKwp01).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
        unreportedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 12,
        requestNo: 'KWP-69-00012',
        form: 'กวภ.01',
        formType: 'KWP01',
        status: 'SUBMITTED',
        submittedAt: '2026-07-04T08:00:00.000Z',
      },
    });
  });

  it('rejects invalid KWP01 payloads before calling service', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp01')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp01Payload(),
        factoryName: '',
        issueReason: 'อื่นๆ',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.createKwp01).not.toHaveBeenCalled();
  });

  it('rejects users without KWP edit permission', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp01')
      .set('Authorization', `Bearer ${tokenWithoutKwpEditPermission()}`)
      .send(validKwp01Payload());

    expect(response.status).toBe(403);
    expect(mockedService.createKwp01).not.toHaveBeenCalled();
  });

  it('gets submitted KWP01 detail with issue report and unreported parameters', async () => {
    mockedService.getById.mockResolvedValueOnce(kwp01DetailResponse());
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp01/12')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.getById).toHaveBeenCalledWith(12, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: undefined,
      publicBaseUrl: expectedPublicBaseUrl,
      publicPath: '/uploads',
      formType: 'KWP01',
    });
    expect(response.body).toEqual({
      success: true,
      data: kwp01DetailResponse(),
    });
  });

  it('gets submitted KWP02 detail with measurement rows and file URLs', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp02/13')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 13,
      formType: 'KWP02',
      form: 'กวภ.02',
      measurementItems: [
        {
          pollutant: 'NOx (ppm)',
          attachments: [
            {
              originalFileName: 'lab-report.pdf',
              fileUrl:
                'http://localhost:3000/uploads/kwp/form-attachments/2026/07/13-lab-report.pdf',
            },
          ],
        },
      ],
    });
  });

  it('gets submitted KWP03 detail with WPMS issue data and file URLs', async () => {
    mockedService.getById.mockResolvedValueOnce(kwp03DetailResponse());
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp03/16')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.getById).toHaveBeenCalledWith(16, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: undefined,
      publicBaseUrl: expectedPublicBaseUrl,
      publicPath: '/uploads',
      formType: 'KWP03',
    });
    expect(response.body.data).toMatchObject({
      id: 16,
      formType: 'KWP03',
      form: 'กวภ.03',
      wpmsIssueReport: {
        wastewaterSource: 'ระบบบำบัดน้ำเสียส่วนกลาง',
        instruments: ['ค่าบีโอดี (BOD)', 'ค่าซีโอดี (COD)'],
        failedParameters: ['BOD (mg/l)', 'COD (mg/l)'],
        attachments: [
          {
            attachmentType: 'WPMS_EVIDENCE',
            fileUrl:
              'http://localhost:3000/uploads/kwp/form-attachments/2026/07/16-wpms-evidence.pdf',
          },
        ],
      },
    });
  });

  it('gets submitted KWP04 detail with measurement rows and file URLs', async () => {
    mockedService.getById.mockResolvedValueOnce({
      ...kwp02DetailResponse(),
      id: 14,
      requestNo: 'KWP-69-00014',
      form: 'กวภ.04',
      formType: 'KWP04',
    });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp04/14')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 14,
      formType: 'KWP04',
      form: 'กวภ.04',
      measurementItems: [
        {
          pollutant: 'NOx (ppm)',
          attachments: [
            {
              attachmentType: 'LAB_REPORT',
              fileUrl:
                'http://localhost:3000/uploads/kwp/form-attachments/2026/07/13-lab-report.pdf',
            },
          ],
        },
      ],
    });
  });

  it('gets submitted KWP05 detail with calibration rows and file URLs', async () => {
    mockedService.getById.mockResolvedValueOnce(kwp05DetailResponse());
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp05/15')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.getById).toHaveBeenCalledWith(15, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: undefined,
      publicBaseUrl: expectedPublicBaseUrl,
      publicPath: '/uploads',
      formType: 'KWP05',
    });
    expect(response.body.data).toMatchObject({
      id: 15,
      formType: 'KWP05',
      form: 'กวภ.05',
      calibrationReport: {
        businessActivity: 'ผลิตกระแสไฟฟ้า',
        reportRound: '1',
        reportYear: '2569',
      },
      calibrationItems: [
        {
          parameter: 'NOx (ppm)',
          result: 'ผ่าน',
          rataReportLink: 'https://example.com/rata-nox',
          attachments: [
            {
              attachmentType: 'RATA_REPORT',
              fileUrl:
                'http://localhost:3000/uploads/kwp/form-attachments/2026/07/15-rata-report.pdf',
            },
          ],
        },
      ],
    });
  });

  it('rejects users without KWP view permission for detail reads', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/kwp02/13')
      .set('Authorization', `Bearer ${tokenWithoutKwpEditPermission()}`);

    expect(response.status).toBe(403);
    expect(mockedService.getById).not.toHaveBeenCalled();
  });

  it('does not expose the generic KWP submission detail route anymore', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/13')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(404);
    expect(mockedService.getById).not.toHaveBeenCalled();
  });

  it('rejects removed START_REVIEW workflow action before calling service', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${officerApproveToken()}`)
      .send({
        action: 'START_REVIEW',
        officerNote: 'รับเรื่องเข้าพิจารณา',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.changeWorkflowStatus).not.toHaveBeenCalled();
  });

  it('gets KWP workflow steps and allowed actions from backend state', async () => {
    mockedService.getWorkflow.mockResolvedValueOnce({
      ...kwpWorkflowResponse(),
      allowedActions: [],
    });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-submissions/12/workflow')
      .set('Authorization', `Bearer ${operatorViewToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.getWorkflow).toHaveBeenCalledWith(12, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      regionalAccess: undefined,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 12,
        currentStep: {
          key: 'SUBMITTED',
          label: 'ส่งฟอร์ม',
        },
        allowedActions: [],
      },
    });
  });

  it('requests KWP workflow revision with required revision note', async () => {
    mockedService.changeWorkflowStatus.mockResolvedValueOnce({
      ...kwpWorkflowResponse(),
      status: 'REVISION_REQUESTED',
      statusLabel: 'รอโรงงานแก้ไข',
      revisionReason: 'เพิ่มเอกสารแนบผลตรวจวัด',
      officerNote: 'เพิ่มเอกสารแนบผลตรวจวัด',
      currentStep: {
        key: 'REVISION_REQUESTED',
        label: 'ส่งแก้ไข',
        status: 'CURRENT',
      },
      allowedActions: ['APPROVE'],
    });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${officerApproveToken()}`)
      .send({
        action: 'REQUEST_REVISION',
        revisionReason: 'เพิ่มเอกสารแนบผลตรวจวัด',
        officerNote: 'ตรวจพบเอกสารแนบยังไม่ครบ',
      });

    expect(response.status).toBe(200);
    expect(mockedService.changeWorkflowStatus).toHaveBeenCalledWith(
      12,
      {
        action: 'REQUEST_REVISION',
        revisionReason: 'เพิ่มเอกสารแนบผลตรวจวัด',
        officerNote: 'ตรวจพบเอกสารแนบยังไม่ครบ',
      },
      {
        actorUserId: 77,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคกลาง'] },
      },
    );
    expect(response.body.data).toMatchObject({
      status: 'REVISION_REQUESTED',
      revisionReason: 'เพิ่มเอกสารแนบผลตรวจวัด',
      currentStep: {
        key: 'REVISION_REQUESTED',
      },
      allowedActions: ['APPROVE'],
    });
  });

  it('updates a returned KWP01 form through the form-specific edit endpoint', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/v1/kwp-form-submissions/kwp01/12')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp01Payload(),
        correctiveAction: 'แก้ไขแผนซ่อมบำรุงตามข้อสังเกตเจ้าหน้าที่',
      });

    expect(response.status).toBe(200);
    expect(mockedService.updateKwp01).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        correctiveAction: 'แก้ไขแผนซ่อมบำรุงตามข้อสังเกตเจ้าหน้าที่',
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
        publicBaseUrl: expectedPublicBaseUrl,
        publicPath: '/uploads',
        regionalAccess: undefined,
      },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 12,
        formType: 'KWP01',
        status: 'REVISION_REQUESTED',
        issueReport: {
          correctiveAction: 'แก้ไขแผนซ่อมบำรุงตามข้อสังเกตเจ้าหน้าที่',
        },
      },
    });
  });

  it('rejects invalid KWP01 edit payloads before calling service', async () => {
    const app = createApp();

    const response = await request(app)
      .patch('/api/v1/kwp-form-submissions/kwp01/12')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp01Payload(),
        factoryName: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.updateKwp01).not.toHaveBeenCalled();
  });

  it('resubmits a returned KWP01 form through the form-specific action endpoint', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp01/12/resubmit')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({ note: 'ปรับข้อมูลและแนบเอกสารครบแล้ว' });

    expect(response.status).toBe(200);
    expect(mockedService.resubmitKwp01).toHaveBeenCalledWith(
      12,
      { note: 'ปรับข้อมูลและแนบเอกสารครบแล้ว' },
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
        regionalAccess: undefined,
      },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 12,
        formType: 'KWP01',
        status: 'SUBMITTED',
        statusLabel: 'แก้ไขแล้ว/รอพิจารณา',
        allowedActions: [],
      },
    });
  });

  it('requires a revision reason when requesting KWP workflow revision', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${officerApproveToken()}`)
      .send({
        action: 'REQUEST_REVISION',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.changeWorkflowStatus).not.toHaveBeenCalled();
  });

  it('creates a submitted KWP02 form with measurement rows and file metadata', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp02')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(validKwp02Payload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/kwp-form-reports/requests/13');
    expect(mockedService.createKwp02).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        measurementItems: [
          expect.objectContaining({
            pollutant: 'NOx (ppm)',
            attachments: [
              expect.objectContaining({
                attachmentType: 'SAMPLING_PHOTO',
                originalFileName: 'sampling-photo.jpg',
              }),
              expect.objectContaining({
                attachmentType: 'LAB_REPORT',
                originalFileName: 'lab-report.pdf',
              }),
            ],
          }),
          expect.objectContaining({
            pollutant: 'SO2 (ppm)',
            attachments: [expect.objectContaining({ attachmentType: 'LAB_REPORT' })],
          }),
        ],
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 13,
        requestNo: 'KWP-69-00013',
        form: 'กวภ.02',
        formType: 'KWP02',
        status: 'SUBMITTED',
        submittedAt: '2026-07-04T08:15:00.000Z',
        measurementItemCount: 2,
        attachmentCount: 3,
      },
    });
  });

  it('creates a submitted KWP03 WPMS issue form with selected options and file metadata', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp03')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(validKwp03Payload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/kwp-form-reports/requests/16');
    expect(mockedService.createKwp03).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        instruments: ['ค่าบีโอดี (BOD)', 'ค่าซีโอดี (COD)'],
        measurementTimes: ['Real Time', '15 นาที'],
        issueReasons: [
          'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
          'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
        ],
        failedParameters: ['BOD (mg/l)', 'COD (mg/l)'],
        attachments: [
          expect.objectContaining({
            attachmentType: 'WPMS_EVIDENCE',
            originalFileName: 'wpms-evidence.pdf',
          }),
          expect.objectContaining({
            attachmentType: 'REPAIR_PLAN',
            originalFileName: 'repair-plan.pdf',
          }),
        ],
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 16,
        requestNo: 'KWP-69-00016',
        form: 'กวภ.03',
        formType: 'KWP03',
        status: 'SUBMITTED',
        submittedAt: '2026-07-04T08:20:00.000Z',
        attachmentCount: 2,
      },
    });
  });

  it('rejects KWP03 payloads whose expected done date is before problem date', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp03')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp03Payload(),
        problemDate: '2026-07-10',
        expectedDoneDate: '2026-07-09',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.createKwp03).not.toHaveBeenCalled();
  });

  it('rejects KWP02 payloads without measurement rows', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp02')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp02Payload(),
        measurementItems: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.createKwp02).not.toHaveBeenCalled();
  });

  it('creates a submitted KWP04 form with measurement rows and file metadata', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp04')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(validKwp02Payload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/kwp-form-reports/requests/14');
    expect(mockedService.createKwp04).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        measurementItems: [
          expect.objectContaining({
            pollutant: 'NOx (ppm)',
            attachments: [
              expect.objectContaining({
                attachmentType: 'SAMPLING_PHOTO',
                originalFileName: 'sampling-photo.jpg',
              }),
              expect.objectContaining({
                attachmentType: 'LAB_REPORT',
                originalFileName: 'lab-report.pdf',
              }),
            ],
          }),
          expect.objectContaining({
            pollutant: 'SO2 (ppm)',
            attachments: [expect.objectContaining({ attachmentType: 'LAB_REPORT' })],
          }),
        ],
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 14,
        requestNo: 'KWP-69-00014',
        form: 'กวภ.04',
        formType: 'KWP04',
        status: 'SUBMITTED',
        submittedAt: '2026-07-04T08:30:00.000Z',
        measurementItemCount: 2,
        attachmentCount: 3,
      },
    });
  });

  it('rejects KWP04 payloads without measurement rows', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp04')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp02Payload(),
        measurementItems: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.createKwp04).not.toHaveBeenCalled();
  });

  it('creates a submitted KWP05 calibration report with rows and file metadata', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp05')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send(validKwp05Payload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/kwp-form-reports/requests/15');
    expect(mockedService.createKwp05).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        businessActivity: 'ผลิตกระแสไฟฟ้า',
        reportRound: '1',
        reportYear: '2569',
        calibrationItems: [
          expect.objectContaining({
            parameter: 'NOx (ppm)',
            result: 'ผ่าน',
            attachments: [
              expect.objectContaining({
                attachmentType: 'RATA_REPORT',
                originalFileName: 'rata-report.pdf',
              }),
              expect.objectContaining({
                attachmentType: 'CALIBRATION_PHOTO',
                originalFileName: 'calibration-photo.jpg',
              }),
            ],
          }),
          expect.objectContaining({
            parameter: 'SO2 (ppm)',
            result: 'ไม่ผ่าน',
          }),
        ],
      }),
      {
        actorUserId: 42,
        scope: 'OWN_FACTORY',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 15,
        requestNo: 'KWP-69-00015',
        form: 'กวภ.05',
        formType: 'KWP05',
        status: 'SUBMITTED',
        submittedAt: '2026-07-04T08:45:00.000Z',
        calibrationItemCount: 2,
        attachmentCount: 4,
      },
    });
  });

  it('rejects KWP05 calibration rows whose end date is before start date', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/kwp05')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .send({
        ...validKwp05Payload(),
        calibrationItems: [
          {
            ...validKwp05Payload().calibrationItems[0],
            startDate: '2026-07-10',
            endDate: '2026-07-09',
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.createKwp05).not.toHaveBeenCalled();
  });
});

function validKwp01Payload() {
  return {
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
    secondaryFuel: 'น้ำมันเตา',
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
    correctiveAction: 'ซ่อมบำรุงเครื่องมือและตรวจสอบระบบรับส่งข้อมูล',
    reporterName: 'สมชาย ทดสอบ',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
  };
}

function validKwp02Payload() {
  return {
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
    secondaryFuel: 'น้ำมันเตา',
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
          {
            attachmentType: 'LAB_REPORT',
            originalFileName: 'lab-report.pdf',
            storedFileName: '13-lab-report.pdf',
            mimeType: 'application/pdf',
            fileSize: 880000,
            storagePath: '/uploads/kwp/13-lab-report.pdf',
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
        attachments: [
          {
            attachmentType: 'LAB_REPORT',
            originalFileName: 'lab-report-so2.pdf',
            mimeType: 'application/pdf',
            fileSize: 640000,
            storagePath: '/uploads/kwp/13-lab-report-so2.pdf',
          },
        ],
      },
    ],
    reporterName: 'สมชาย ทดสอบ',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
  };
}

function validKwp03Payload() {
  return {
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
    averageDischarge: 125.5,
    minimumDischarge: 100.25,
    maximumDischarge: 150.75,
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
      {
        attachmentType: 'REPAIR_PLAN',
        originalFileName: 'repair-plan.pdf',
        storedFileName: '16-repair-plan.pdf',
        mimeType: 'application/pdf',
        fileSize: 480000,
        storagePath: '/uploads/kwp/16-repair-plan.pdf',
      },
    ],
    reporterName: 'สมชาย ทดสอบ',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
  };
}

function validKwp05Payload() {
  return {
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
    secondaryFuel: 'น้ำมันเตา',
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
          {
            attachmentType: 'CALIBRATION_PHOTO',
            originalFileName: 'calibration-photo.jpg',
            storedFileName: '15-calibration-photo.jpg',
            mimeType: 'image/jpeg',
            fileSize: 220000,
            storagePath: '/uploads/kwp/15-calibration-photo.jpg',
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
        attachments: [
          {
            attachmentType: 'RATA_REPORT',
            originalFileName: 'rata-report-so2.pdf',
            mimeType: 'application/pdf',
            fileSize: 640000,
            storagePath: '/uploads/kwp/15-rata-report-so2.pdf',
          },
          {
            attachmentType: 'CALIBRATION_PHOTO',
            originalFileName: 'calibration-photo-so2.png',
            mimeType: 'image/png',
            fileSize: 180000,
            storagePath: '/uploads/kwp/15-calibration-photo-so2.png',
          },
        ],
      },
    ],
    reporterName: 'สมชาย ทดสอบ',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
  };
}

function operatorToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'kwp_forms:edit': 'OWN_FACTORY',
    },
  });
}

function operatorViewToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'kwp_forms:view': 'OWN_FACTORY',
    },
  });
}

function officerApproveToken(): string {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: {
      'kwp_forms:view': 'ALL',
      'kwp_forms:approve': 'ALL',
    },
    regionalAccess: { regions: ['ภาคกลาง'] },
  });
}

function tokenWithoutKwpEditPermission(): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['public_user'],
    scopes: {},
  });
}

function kwpWorkflowResponse() {
  return {
    id: 12,
    requestNo: 'KWP-69-00012',
    form: 'กวภ.01' as const,
    formType: 'KWP01' as const,
    status: 'SUBMITTED' as const,
    statusLabel: 'รอพิจารณา',
    revisionReason: null,
    officerNote: null,
    reviewedAt: null,
    currentStep: {
      key: 'SUBMITTED' as const,
      label: 'ส่งฟอร์ม',
      status: 'CURRENT' as const,
    },
    steps: [
      { key: 'SUBMITTED' as const, label: 'ส่งฟอร์ม', status: 'CURRENT' as const },
      { key: 'REVISION_REQUESTED' as const, label: 'ส่งแก้ไข', status: 'PENDING' as const },
    ],
    allowedActions: ['REQUEST_REVISION' as const, 'APPROVE' as const],
  };
}

function kwp01DetailResponse() {
  return {
    ...commonDetailFields(),
    id: 12,
    requestNo: 'KWP-69-00012',
    form: 'กวภ.01' as const,
    formType: 'KWP01' as const,
    status: 'SUBMITTED',
    submittedAt: '2026-07-04T08:00:00.000Z',
    issueReport: {
      issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง' as const,
      reasonDetail: 'เครื่องวิเคราะห์ก๊าซไม่สามารถส่งข้อมูลได้',
      problemDate: '2026-07-01',
      expectedDoneDate: '2026-07-05',
      totalDays: 5,
      correctiveAction: 'ซ่อมบำรุงเครื่องมือและตรวจสอบระบบรับส่งข้อมูล',
      unreportedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
    },
  };
}

function kwp02DetailResponse() {
  return {
    ...commonDetailFields(),
    id: 13,
    requestNo: 'KWP-69-00013',
    form: 'กวภ.02' as const,
    formType: 'KWP02' as const,
    status: 'SUBMITTED',
    submittedAt: '2026-07-04T08:15:00.000Z',
    measurementItems: [
      {
        id: 31,
        pollutant: 'NOx (ppm)',
        sampleDate: '2026-07-01',
        measuredValue: '110.25',
        numericValue: 110.25,
        unit: 'ppm',
        laboratoryNo: 'LAB-001',
        reportNo: 'RPT-001',
        method: 'USEPA Method 7E',
        attachments: [
          {
            id: 51,
            attachmentType: 'LAB_REPORT',
            originalFileName: 'lab-report.pdf',
            storedFileName: '13-lab-report.pdf',
            mimeType: 'application/pdf',
            fileSize: 880000,
            storagePath: 'kwp/form-attachments/2026/07/13-lab-report.pdf',
            fileUrl: 'http://localhost:3000/uploads/kwp/form-attachments/2026/07/13-lab-report.pdf',
            uploadedAt: '2026-07-04T08:15:00.000Z',
            uploadedBy: 42,
          },
        ],
      },
    ],
  };
}

function kwp03DetailResponse() {
  return {
    ...commonDetailFields(),
    id: 16,
    requestNo: 'KWP-69-00016',
    form: 'กวภ.03' as const,
    formType: 'KWP03' as const,
    status: 'SUBMITTED',
    submittedAt: '2026-07-04T08:20:00.000Z',
    pointCode: 'P0001',
    pointName: 'จุดระบายน้ำทิ้ง A',
    pointType: 'WATER',
    wpmsIssueReport: {
      wastewaterSource: 'ระบบบำบัดน้ำเสียส่วนกลาง',
      receivingSource: 'คลองสาธารณะ',
      treatmentSystemType: 'ระบบตะกอนเร่ง',
      dischargePoint: 'UTM 123456, 987654',
      averageDischarge: '125.500000',
      minimumDischarge: '100.250000',
      maximumDischarge: '150.750000',
      reasonDetail: 'สัญญาณเครือข่ายขัดข้องและต้องเปลี่ยนอุปกรณ์ตรวจวัด',
      problemDate: '2026-07-01',
      expectedDoneDate: '2026-07-05',
      totalDays: 5,
      correctiveAction: 'เปลี่ยนอุปกรณ์และทดสอบการส่งข้อมูล WPMS',
      instruments: ['ค่าบีโอดี (BOD)', 'ค่าซีโอดี (COD)'],
      measurementTimes: ['Real Time', '15 นาที'],
      issueReasons: [
        'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง' as const,
        'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง' as const,
      ],
      failedParameters: ['BOD (mg/l)', 'COD (mg/l)'],
      attachments: [
        {
          id: 81,
          attachmentType: 'WPMS_EVIDENCE',
          originalFileName: 'wpms-evidence.pdf',
          storedFileName: '16-wpms-evidence.pdf',
          mimeType: 'application/pdf',
          fileSize: 760000,
          storagePath: 'kwp/form-attachments/2026/07/16-wpms-evidence.pdf',
          fileUrl:
            'http://localhost:3000/uploads/kwp/form-attachments/2026/07/16-wpms-evidence.pdf',
          uploadedAt: '2026-07-04T08:20:00.000Z',
          uploadedBy: 42,
        },
      ],
    },
  };
}

function kwp05DetailResponse() {
  return {
    ...commonDetailFields(),
    id: 15,
    requestNo: 'KWP-69-00015',
    form: 'กวภ.05' as const,
    formType: 'KWP05' as const,
    status: 'SUBMITTED',
    submittedAt: '2026-07-04T08:45:00.000Z',
    calibrationReport: {
      businessActivity: 'ผลิตกระแสไฟฟ้า',
      samplerName: 'สมหญิง เก็บตัวอย่าง',
      officerRegistration: 'OFF-001',
      laboratoryName: 'ห้องปฏิบัติการทดสอบ จำกัด',
      laboratoryRegistration: 'LAB-REG-001',
      cemsBrand: 'CEMS Brand A',
      cemsDetail: 'CEMS Brand A รุ่น Model X',
      reportRound: '1',
      reportYear: '2569',
    },
    calibrationItems: [
      {
        id: 61,
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
            id: 71,
            attachmentType: 'RATA_REPORT',
            originalFileName: 'rata-report.pdf',
            storedFileName: '15-rata-report.pdf',
            mimeType: 'application/pdf',
            fileSize: 840000,
            storagePath: 'kwp/form-attachments/2026/07/15-rata-report.pdf',
            fileUrl:
              'http://localhost:3000/uploads/kwp/form-attachments/2026/07/15-rata-report.pdf',
            uploadedAt: '2026-07-04T08:45:00.000Z',
            uploadedBy: 42,
          },
        ],
      },
    ],
  };
}

function commonDetailFields() {
  return {
    createdAt: '2026-07-04T08:00:00.000Z',
    updatedAt: '2026-07-04T08:00:00.000Z',
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
    secondaryFuel: 'น้ำมันเตา',
    combustionSystem: 'ระบบปิด',
    productionCapacity: '100',
    productionCapacityUnit: 'ตัน/วัน',
    contactName: 'สมชาย ทดสอบ',
    contactPhone: '0812345678',
    contactEmail: 'operator@example.com',
    reporterName: 'สมชาย ทดสอบ',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
  };
}
