import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/kwp-form-reports/kwp-form-reports.service', () => ({
  kwpFormReportsService: {
    listFactories: jest.fn(),
    listRequests: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { kwpFormReportsService } from '../../src/modules/kwp-form-reports/kwp-form-reports.service';

const mockedService = jest.mocked(kwpFormReportsService);

describe('KWP form report routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listFactories.mockResolvedValue({
      data: [
        {
          id: 'FID-001',
          factoryId: 'FID-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          newRegistrationNo: '10190000225448',
          oldRegistrationNo: '3-101-2/44สบ',
          industryType: '10100 / 3',
          industryMainOrder: '1010',
          businessActivity: 'ผลิตเคมีภัณฑ์',
          province: 'สระบุรี',
          address: '9 หมู่ 9',
          monitoringPointCount: 2,
        },
      ],
      meta: { total: 1 },
    });
    mockedService.listRequests.mockResolvedValue({
      data: [
        {
          id: 9,
          factoryId: 'FID-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryRegistration: '10190000225448',
          industryType: '10100 / 3',
          factoryAddress: '9 หมู่ 9',
          province: 'สระบุรี',
          type: 'CEMS',
          monitoringPointCode: 'S0001',
          monitoringPointName: 'ปล่องระบาย A',
          requestNo: 'KWP-69-00001',
          form: 'กวภ.01',
          formType: 'KWP01',
          submittedDate: '15/06/2569',
          reviewedDate: '-',
          status: 'รอพิจารณา',
          statusCode: 'SUBMITTED',
          revisionNote: null,
          statusHistory: [],
        },
      ],
      meta: { total: 1 },
    });
  });

  it('lists operator-owned factories for the factory table', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-reports/factories')
      .set('Authorization', `Bearer ${operatorToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.listFactories).toHaveBeenCalledWith(
      42,
      'OWN_FACTORY',
      undefined,
      undefined,
    );
    expect(response.body.data[0]).toMatchObject({
      factoryName: 'บริษัท ทดสอบ จำกัด',
      newRegistrationNo: '10190000225448',
      oldRegistrationNo: '3-101-2/44สบ',
      industryMainOrder: '1010',
      businessActivity: 'ผลิตเคมีภัณฑ์',
      monitoringPointCount: 2,
    });
  });

  it('lists request rows for officers using KWP menu permission and regional access', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-reports/requests?formType=KWP01&status=SUBMITTED')
      .set('Authorization', `Bearer ${officerToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.listRequests).toHaveBeenCalledWith(
      { formType: 'KWP01', status: 'SUBMITTED' },
      77,
      'ALL',
      { regions: ['ภาคกลาง'] },
      undefined,
    );
    expect(response.body.data[0]).toMatchObject({
      requestNo: 'KWP-69-00001',
      form: 'กวภ.01',
      submittedDate: '15/06/2569',
      status: 'รอพิจารณา',
    });
  });

  it('passes selected KWP menu region to request list access', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-reports/requests')
      .set('Authorization', `Bearer ${regionalKwpOfficerToken()}`);

    expect(response.status).toBe(200);
    expect(mockedService.listRequests).toHaveBeenCalledWith(
      {},
      78,
      'IN_REGION',
      { regions: ['ภาคกลาง'] },
      { regions: ['ภาคตะวันออก'] },
    );
  });

  it('rejects users without KWP form permission', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/kwp-form-reports/requests')
      .set('Authorization', `Bearer ${tokenWithoutKwpPermission()}`);

    expect(response.status).toBe(403);
    expect(mockedService.listRequests).not.toHaveBeenCalled();
  });
});

function operatorToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'kwp_forms:view': 'OWN_FACTORY',
    },
  });
}

function officerToken(): string {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: {
      'kwp_forms:view': 'ALL',
    },
    regionalAccess: { regions: ['ภาคกลาง'] },
  });
}

function regionalKwpOfficerToken(): string {
  return signAccessToken({
    sub: '78',
    userType: 'officer',
    roles: ['monitoring_region'],
    scopes: {
      'kwp_forms:view': 'IN_REGION',
    },
    scopeDetails: {
      'kwp_forms:view': {
        scope: 'IN_REGION',
        region: 'ภาคตะวันออก',
        province: null,
      },
    },
    regionalAccess: { regions: ['ภาคกลาง'] },
  });
}

function tokenWithoutKwpPermission(): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['public_user'],
    scopes: {
      'factories:view': 'ALL',
    },
  });
}
