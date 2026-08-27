import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundError } from '../../src/shared/errors/AppError';

jest.mock('../../src/modules/integrations/integration-factory-dashboard.service', () => ({
  integrationFactoryDashboardService: {
    getByRegistrationNo: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { integrationFactoryDashboardService } from '../../src/modules/integrations/integration-factory-dashboard.service';

const mockedService = jest.mocked(integrationFactoryDashboardService);
const registrationNo = '40100007125560';

describe('integration factory dashboard route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FACTORY_DASHBOARD_API_KEYS = 'factory-dashboard-test-key';
    process.env.INTEGRATION_API_KEYS = 'generic-integration-key';
    mockedService.getByRegistrationNo.mockResolvedValue({
      data: [
        {
          factoryId: registrationNo,
          factoryName: 'บริษัท ตัวอย่าง จำกัด',
          newRegistrationNo: registrationNo,
          hasLatestHourlyMeasurement: true,
          measurementPoints: [
            {
              stationId: 'S4010',
              parameters: ['CO (ppm)'],
              data: [
                {
                  station_id: 'S4010',
                  'CO (ppm)': 0.1,
                  cdate: '2026-08-26',
                  ctime: '21:00:00',
                },
              ],
            },
          ],
        },
      ],
      meta: { total: 1 },
    } as never);
  });

  it('returns one factory dashboard with a dedicated API key', async () => {
    const response = await request(createApp())
      .get(`/integrations/lasthour/factories/${registrationNo}`)
      .set('X-API-Key', 'factory-dashboard-test-key');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mockedService.getByRegistrationNo).toHaveBeenCalledWith(registrationNo);
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          factoryId: registrationNo,
          hasLatestHourlyMeasurement: true,
          measurementPoints: [{ parameters: ['CO (ppm)'] }],
        },
      ],
      meta: { total: 1 },
    });
  });

  it('rejects a missing API key', async () => {
    const response = await request(createApp()).get(
      `/integrations/lasthour/factories/${registrationNo}`,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockedService.getByRegistrationNo).not.toHaveBeenCalled();
  });

  it('does not accept the generic integration API key', async () => {
    const response = await request(createApp())
      .get(`/integrations/lasthour/factories/${registrationNo}`)
      .set('X-API-Key', 'generic-integration-key');

    expect(response.status).toBe(401);
    expect(mockedService.getByRegistrationNo).not.toHaveBeenCalled();
  });

  it('rejects an invalid factory registration number', async () => {
    const response = await request(createApp())
      .get('/integrations/lasthour/factories/ABC123')
      .set('X-API-Key', 'factory-dashboard-test-key');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedService.getByRegistrationNo).not.toHaveBeenCalled();
  });

  it('returns 404 when the connected POMS factory does not exist', async () => {
    mockedService.getByRegistrationNo.mockRejectedValue(
      new NotFoundError('Connected POMS factory not found'),
    );

    const response = await request(createApp())
      .get(`/integrations/lasthour/factories/${registrationNo}`)
      .set('X-API-Key', 'factory-dashboard-test-key');

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Connected POMS factory not found',
    });
  });

  it('keeps the previous API-prefixed endpoint as a compatibility alias', async () => {
    const response = await request(createApp())
      .get(`/api/v1/integrations/factories/${registrationNo}/dashboard`)
      .set('X-API-Key', 'factory-dashboard-test-key');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.deprecation).toBe('true');
    expect(mockedService.getByRegistrationNo).toHaveBeenCalledWith(registrationNo);
  });
});
