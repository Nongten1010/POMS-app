import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    getForm: jest.fn(),
  },
}));

const mockedService = jest.mocked(connectionRequestsService);

describe('GET /api/v1/cems-wpms-requests/:id/form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.getForm.mockResolvedValue({
      requestType: 'NEW_CONNECTION',
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      factoryRegistrationNo: '3-106-33/50สบ',
      systemType: 'CEMS',
      contactName: 'สมชาย ใจดี',
      contactPhone: '0812345678',
      measurementPoints: [
        {
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          parameters: ['CO (ppm)'],
        },
      ],
    });
  });

  it('returns the standard success envelope and reuses the request view scope', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/cems-wpms-requests/17/form')
      .set('Authorization', `Bearer ${viewToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        requestType: 'NEW_CONNECTION',
        factoryId: 'factory-001',
        measurementPoints: [expect.objectContaining({ pointName: 'ปล่องระบาย A' })],
      }),
    });
    expect(mockedService.getForm).toHaveBeenCalledWith(17, 42, { scope: 'OWN_FACTORY' });
  });

  it('requires cems_wpms_requests:view', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/cems-wpms-requests/17/form')
      .set('Authorization', `Bearer ${tokenWithoutViewPermission()}`);

    expect(response.status).toBe(403);
    expect(mockedService.getForm).not.toHaveBeenCalled();
  });
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function viewToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'cems_wpms_requests:view': 'OWN_FACTORY',
    },
  });
}

function tokenWithoutViewPermission(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {},
  });
}
