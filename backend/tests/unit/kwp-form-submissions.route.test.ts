import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/kwp-form-submissions/kwp-form-submissions.service', () => ({
  kwpFormSubmissionsService: {
    createKwp01: jest.fn(),
  },
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
