import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    listSearchOptions: jest.fn(),
    listOperatorFactories: jest.fn(),
    listOperatorFactoryDashboard: jest.fn(),
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
          id: 1,
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          newRegistrationNo: '3-106-33/50สบ',
          oldRegistrationNo: '3-106-33/50สบ',
          industryType: 'ผลิตเคมีภัณฑ์',
          industryMainOrder: '106',
          industrySubOrder: '33',
          businessActivity: 'ผลิตเคมีภัณฑ์',
          eia: 'มี',
          projectName: null,
          address: '99 หมู่ 1',
          latitude: '13.7563',
          longitude: '100.5018',
          province: 'สระบุรี',
          isEligible: true,
          eligibilityStatus: 'เข้าข่าย',
          monitoringPointCount: 1,
          requestStatusCode: 'CONNECTED',
          status: 'แสดง',
        },
      ],
      meta: { total: 1 },
    });
    mockedConnectionRequestsService.listOperatorFactoryDashboard.mockResolvedValue({
      data: [
        {
          id: 1,
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          newRegistrationNo: '3-106-33/50สบ',
          oldRegistrationNo: 'รง.4-เก่า-001',
          factoryLogoUrl: null,
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
    mockedConnectionRequestsService.listSearchOptions.mockResolvedValue({
      factoryMainTypes: [
        {
          code: '8802',
          label: '8802',
          description: 'ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน',
        },
      ],
      regions: [{ code: 'ภาคตะวันออก', label: 'ภาคตะวันออก' }],
      provinces: [{ code: '21', label: 'ระยอง' }],
      districts: [{ code: null, label: 'เมืองระยอง' }],
      subdistricts: [{ code: null, label: 'มาบตาพุด' }],
      industrialEstates: [{ code: 'MTP', label: 'นิคมอุตสาหกรรมมาบตาพุด' }],
    });
  });

  it('keeps the operator factory list response in the original table shape', async () => {
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
    expect(response.body.data[0]).toEqual({
      id: 1,
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      newRegistrationNo: '3-106-33/50สบ',
      oldRegistrationNo: '3-106-33/50สบ',
      industryType: 'ผลิตเคมีภัณฑ์',
      industryMainOrder: '106',
      industrySubOrder: '33',
      businessActivity: 'ผลิตเคมีภัณฑ์',
      eia: 'มี',
      projectName: null,
      address: '99 หมู่ 1',
      latitude: '13.7563',
      longitude: '100.5018',
      province: 'สระบุรี',
      isEligible: true,
      eligibilityStatus: 'เข้าข่าย',
      monitoringPointCount: 1,
      requestStatusCode: 'CONNECTED',
      status: 'แสดง',
    });
    expect(response.body.data[0]).not.toHaveProperty('measurementPoints');
    expect(response.body.data[0]).not.toHaveProperty('monitoringPointCountBySystem');
  });

  it('uses a separate connected-only route for the operator dashboard', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/operator-factory-dashboard?systemType=WPMS')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listOperatorFactoryDashboard).toHaveBeenCalledWith(
      42,
      'OWN_FACTORY',
      { systemType: 'WPMS', favoriteOnly: false, connectedOnly: true },
    );
  });

  it('does not expose the operator dashboard under cems-wpms requests', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/cems-wpms-requests/operator-factory-dashboard?systemType=WPMS')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(404);
    expect(mockedConnectionRequestsService.listOperatorFactoryDashboard).not.toHaveBeenCalled();
  });

  it('updates the favorite flag for an accessible factory', async () => {
    const app = createApp();

    const response = await request(app)
      .put('/api/v1/operator-factories/factory-001/favorite')
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

  it('lists advanced-search options from request factory snapshots', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/cems-wpms-requests/search-options')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listSearchOptions).toHaveBeenCalledWith(
      42,
      'OWN_FACTORY',
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        factoryMainTypes: [
          {
            code: '8802',
            label: '8802',
            description: 'ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน',
          },
        ],
        regions: [{ code: 'ภาคตะวันออก', label: 'ภาคตะวันออก' }],
        provinces: [{ code: '21', label: 'ระยอง' }],
        districts: [{ code: null, label: 'เมืองระยอง' }],
        subdistricts: [{ code: null, label: 'มาบตาพุด' }],
        industrialEstates: [{ code: 'MTP', label: 'นิคมอุตสาหกรรมมาบตาพุด' }],
      },
    });
  });

  it('does not expose favorite updates under cems-wpms requests', async () => {
    const app = createApp();

    const response = await request(app)
      .put('/api/v1/cems-wpms-requests/operator-factories/factory-001/favorite')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ isFavorite: true });

    expect(response.status).toBe(404);
    expect(mockedConnectionRequestsService.setOperatorFactoryFavorite).not.toHaveBeenCalled();
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'factories:view': 'OWN_FACTORY',
      'cems_wpms_requests:view': 'OWN_FACTORY',
      'dashboard.alerts:view': null,
    },
  });
}
