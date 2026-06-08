import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    listConnectedMeasurementPoints: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);

describe('connected measurement points route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsService.listConnectedMeasurementPoints.mockResolvedValue({
      data: [
        {
          id: 1,
          requestId: 10,
          requestNo: 'CEMS6900001',
          factory: null,
          type: 'CEMS',
          status: 'เชื่อมต่อแล้ว',
          statusCode: 'CONNECTED',
          connectedAt: '2026-06-08T00:00:00.000Z',
          point: {
            id: 1,
            pointName: 'S0001',
            pointCode: 'S0001',
            pointType: 'STACK',
            latitude: null,
            longitude: null,
            parameters: ['NOx'],
            description: null,
          },
          deviceConfigs: [],
        },
      ],
      meta: {
        total: 1,
      },
    });
  });

  it('exposes current connected measurement points outside the request route namespace', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points?stationId=S0001')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listConnectedMeasurementPoints).toHaveBeenCalledWith(
      { stationId: 'S0001', factoryId: undefined },
      42,
      'ALL',
    );
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          point: {
            pointCode: 'S0001',
          },
          deviceConfigs: [],
        },
      ],
      meta: {
        total: 1,
      },
    });
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:view': 'ALL',
    },
  });
}
