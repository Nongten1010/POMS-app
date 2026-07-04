import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/kwp-form-submissions/kwp-form-submissions.service', () => ({
  kwpFormSubmissionsService: {
    createKwp01: jest.fn(),
    createKwp02: jest.fn(),
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

function tokenWithoutKwpEditPermission(): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['public_user'],
    scopes: {
      'kwp_forms:view': 'ALL',
    },
  });
}
