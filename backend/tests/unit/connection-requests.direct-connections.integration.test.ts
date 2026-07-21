import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findDirectConnectionFactory: jest.fn(),
    createDirectConnection: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedRepository = connectionRequestsRepository as unknown as {
  findDirectConnectionFactory: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  createDirectConnection: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('POST /api/v1/cems-wpms-requests/direct-connections integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.findDirectConnectionFactory.mockResolvedValue({
      eligibleFactoryId: 17,
      factoryId: '10120000325542',
      factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
      newRegistrationNo: '10120000325542',
    });
    mockedRepository.createDirectConnection.mockResolvedValue({
      id: 91,
      requestNo: 'OLDC-69-00001',
      requestType: 'ADD_MEASUREMENT_POINT',
      status: 'CONNECTED',
      statusLabel: 'เชื่อมต่อแล้ว',
      submissionSource: 'OFFICER_DIRECT_API',
    });
  });

  it('creates a direct connection for an accessible eligible factory without a POMS factory row', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send(validPayload());

    expect({ status: response.status, body: response.body }).toMatchObject({
      status: 201,
      body: { success: true },
    });
    expect(response.body).toMatchObject({
      success: true,
      data: {
        requestNo: 'OLDC-69-00001',
        status: 'CONNECTED',
        submissionSource: 'OFFICER_DIRECT_API',
      },
    });
    expect(mockedRepository.findDirectConnectionFactory).toHaveBeenCalledWith(
      {
        factoryId: '10120000325542',
        factoryRegistrationNo: '3-34(3)-3/54นบ',
      },
      expect.objectContaining({ actorUserId: 42, scope: { scope: 'ALL' } }),
    );
    expect(mockedRepository.createDirectConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        eligibleFactoryId: 17,
        factoryId: '10120000325542',
        factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
        factoryRegistrationNo: '10120000325542',
        latitude: 13.923456,
        longitude: 100.456789,
        measurementPoints: [expect.objectContaining({ pointCode: 'S1125' })],
      }),
      42,
    );
  });

  it('returns 404 without writing when the eligible factory is outside officer access', async () => {
    mockedRepository.findDirectConnectionFactory.mockResolvedValueOnce(null);

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send(validPayload());

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Active eligible factory not found within officer access scope',
      },
    });
    expect(mockedRepository.createDirectConnection).not.toHaveBeenCalled();
  });
});

function validPayload() {
  return {
    factoryId: '10120000325542',
    factoryName: 'ชื่อจากหน้าจอ',
    factoryRegistrationNo: '3-34(3)-3/54นบ',
    eia: 'ไม่มี',
    eiaOther: null,
    hasEia: false,
    latitude: 13.923456,
    longitude: 100.456789,
    systemType: 'CEMS',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'officer@example.com',
      },
    ],
    measurementPoints: [
      {
        pointName: 'Boiler 35 T',
        pointCode: 'S1125',
        pointType: 'STACK',
        details: {
          stackShape: 'วงกลม',
          stackDiameter: 1.2,
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [
          {
            title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
            fileUrl: 'https://example.com/factory-front.jpg',
          },
        ],
        measurementInstruments: {
          converterBrand: null,
          converterModel: null,
          parameters: [],
        },
      },
    ],
  };
}

function officerToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: { 'cems_wpms_requests:direct_connect': 'ALL' },
  });
}
