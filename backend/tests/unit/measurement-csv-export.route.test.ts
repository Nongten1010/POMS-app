import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findCurrentPomsFactoryNamesForRequests: jest.fn(),
    list: jest.fn(),
  },
}));

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    listRegisteredParameters: jest.fn(),
    listRows: jest.fn(),
    stationExists: jest.fn(),
    tableExists: jest.fn(),
    tableName: jest.fn((stationId: string, interval: string) => `${stationId}_data_${interval}`),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';

const mockedConnectionRequestsRepository = jest.mocked(connectionRequestsRepository);
const mockedParameterValuesRepository = jest.mocked(parameterValuesRepository);

describe('measurement CSV export HTTP seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsRepository.list.mockResolvedValue({
      rows: [
        {
          id: 10,
          requestNo: 'CEMS6900001',
          factoryId: 'factory-001',
          factoryRegistrationNo: '10120000325542',
          factoryName: 'ชื่อจากคำขอเดิม',
          systemType: 'CEMS',
          status: 'CONNECTED',
          measurementPoints: [
            {
              id: 1,
              pointName: 'ปล่อง S0199',
              pointCode: 'S0199',
              parameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
            },
          ],
        },
      ],
      total: 1,
    } as Awaited<ReturnType<typeof connectionRequestsRepository.list>>);
    mockedConnectionRequestsRepository.findCurrentPomsFactoryNamesForRequests.mockResolvedValue(
      new Map([['factory-001', 'โรงไฟฟ้าพระนครเหนือ ชุดที่ 2']]),
    );
    mockedParameterValuesRepository.canAccessStation.mockResolvedValue(true);
    mockedParameterValuesRepository.stationExists.mockResolvedValue(true);
    mockedParameterValuesRepository.tableExists.mockResolvedValue(true);
    mockedParameterValuesRepository.listRegisteredParameters.mockResolvedValue([
      'CO (ppm)',
      'Flow Rate (m3/hr)',
    ]);
    mockedParameterValuesRepository.listRows.mockResolvedValue({
      tableName: 'S0199_data_60m',
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '00:00:00',
          co_value: 76.74,
          co_status: 1,
          flow_value: 94.2,
          flow_status: 1,
        },
        {
          cdate: '2026-08-09',
          ctime: '01:00:00',
          co_value: 70,
          co_status: 0,
          flow_value: 80,
          flow_status: 9,
        },
      ],
    });
  });

  it('requires authentication before exporting measurement data', async () => {
    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('downloads the golden hourly CSV through the authenticated endpoint', async () => {
    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="measurement-S0199-hourly-2026-08-09-2026-08-09.csv"',
    );
    expect(response.text).toBe(
      '\uFEFFdate_time,factory_name,meas_code,CO (ppm),Flow Rate (m3/hr)\r\n' +
        '2026-08-09 00:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,S0199,76.74,94.20\r\n' +
        '2026-08-09 01:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,S0199,NoData,No Discharge\r\n',
    );
  });

  it('rejects users who can view statistics but do not have export permission', async () => {
    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      })
      .set('Authorization', `Bearer ${statisticsViewOnlyToken()}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('returns NO_EXPORT_DATA without starting a CSV download when the range has no rows', async () => {
    mockedParameterValuesRepository.listRows.mockResolvedValue({
      tableName: 'S0199_data_60m',
      rows: [],
    });

    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NO_EXPORT_DATA' },
    });
  });

  it('returns 404 when the interval source table does not exist', async () => {
    mockedParameterValuesRepository.tableExists.mockResolvedValue(false);

    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('rejects a parameter that is not registered for the selected station', async () => {
    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'SO2 (ppm)',
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'BAD_REQUEST' },
    });
  });

  it('rejects an out-of-scope station before loading its factory metadata', async () => {
    mockedParameterValuesRepository.canAccessStation.mockResolvedValue(false);
    mockedParameterValuesRepository.stationExists.mockResolvedValue(true);
    mockedConnectionRequestsRepository.list.mockRejectedValue(
      new Error('factory metadata must not be loaded outside export scope'),
    );

    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'hourly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      })
      .set('Authorization', `Bearer ${provinceExportAccessToken()}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('returns 404 for a station that does not exist without loading factory metadata', async () => {
    mockedParameterValuesRepository.canAccessStation.mockResolvedValue(false);
    mockedParameterValuesRepository.stationExists.mockResolvedValue(false);
    mockedConnectionRequestsRepository.list.mockRejectedValue(
      new Error('factory metadata must not be loaded for a missing station'),
    );

    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/UNKNOWN/measurement-export.csv')
      .query({
        frequency: 'daily',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('uses the daily source interval and emits midnight when a daily row has no time', async () => {
    mockedParameterValuesRepository.listRows.mockImplementationOnce(async (query) => {
      if (query.interval !== '1day') throw new Error('daily export must read the 1day table');
      return {
        tableName: 'S0199_data_1day',
        rows: [{ cdate: '2026-08-09', co_value: 18.5, co_status: 1 }],
      };
    });

    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query({
        frequency: 'daily',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'CO (ppm)',
      })
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(
      '2026-08-09 00:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,S0199,18.50\r\n',
    );
  });

  it.each([
    {
      name: 'unsupported monthly frequency',
      query: {
        frequency: 'monthly',
        startDate: '2026-08-09',
        endDate: '2026-08-09',
        parameters: 'all',
      },
    },
    {
      name: 'hourly range longer than 366 inclusive days',
      query: {
        frequency: 'hourly',
        startDate: '2026-01-01',
        endDate: '2027-01-02',
        parameters: 'all',
      },
    },
  ])('returns the validation envelope for $name', async ({ query }) => {
    const response = await request(createApp())
      .get('/api/v1/connected-measurement-points/S0199/measurement-export.csv')
      .query(query)
      .set('Authorization', `Bearer ${exportAccessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});

function exportAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'dashboard.stats:export': 'ALL',
    },
  });
}

function statisticsViewOnlyToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'dashboard.stats:view': 'ALL',
    },
  });
}

function provinceExportAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'dashboard.stats:export': 'IN_PROVINCE',
    },
  });
}
