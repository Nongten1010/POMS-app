import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    listOperatorFactories: jest.fn(),
    setOperatorFactoryFavorite: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);

describe('operator factory dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsService.listOperatorFactories.mockResolvedValue({
      data: [
        {
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          newRegistrationNo: '3-106-33/50สบ',
          province: 'สระบุรี',
          address: '99 หมู่ 1',
          latitude: '13.7563',
          longitude: '100.5018',
          isFavorite: true,
          monitoringPointCountBySystem: [
            { systemType: 'CEMS', count: 0 },
            { systemType: 'WPMS', count: 1 },
          ],
          status: 'แสดง',
          measurementPoints: [
            {
              stationId: 'P0001',
              pointName: 'น้ำทิ้ง A',
              pointCode: 'P0001',
              systemType: 'WPMS',
              parameters: ['BOD (mg/L)'],
              data: [
                {
                  station_id: 'NB-C21',
                  cdate: '2026-02-25',
                  ctime: '22.00-22.59 น.',
                  'BOD (mg/L)': 12.3,
                },
              ],
            },
          ],
        },
      ],
      meta: { total: 1 },
    });
    mockedConnectionRequestsService.setOperatorFactoryFavorite.mockResolvedValue({
      factoryId: 'factory-001',
      isFavorite: true,
    });
  });

  it('passes system type filters to the scoped operator factory list', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/cems-wpms-requests/operator-factories?systemType=WPMS')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listOperatorFactories).toHaveBeenCalledWith(
      42,
      'OWN_FACTORY',
      { systemType: 'WPMS', favoriteOnly: false },
    );
    expect(response.body.data[0]).toMatchObject({
      factoryId: 'factory-001',
      isFavorite: true,
      monitoringPointCountBySystem: expect.arrayContaining([{ systemType: 'WPMS', count: 1 }]),
      status: 'แสดง',
      measurementPoints: [
        { stationId: 'P0001', systemType: 'WPMS', data: [{ 'BOD (mg/L)': 12.3 }] },
      ],
    });
    expect(response.body.data[0]).not.toHaveProperty('requestStatusCode');
    expect(response.body.data[0]).not.toHaveProperty('systemTypes');
    expect(response.body.data[0].measurementPoints[0]).not.toHaveProperty('requestId');
  });

  it('updates the favorite flag for an accessible factory', async () => {
    const app = createApp();

    const response = await request(app)
      .put('/api/v1/cems-wpms-requests/operator-factories/factory-001/favorite')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ isFavorite: true });

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.setOperatorFactoryFavorite).toHaveBeenCalledWith(
      'factory-001',
      true,
      42,
      'OWN_FACTORY',
    );
    expect(response.body).toEqual({
      success: true,
      data: { factoryId: 'factory-001', isFavorite: true },
    });
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'factories:view': 'OWN_FACTORY',
      'dashboard.alerts:view': null,
    },
  });
}
