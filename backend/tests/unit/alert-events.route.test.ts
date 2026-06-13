import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/alert-events/alert-events.service', () => ({
  alertEventsService: {
    createFromIntegration: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';

const mockedAlertEventsService = jest.mocked(alertEventsService);

describe('alert events routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTEGRATION_API_KEYS = 'test-integration-key';
    process.env.DEVICE_CONFIG_API_KEYS = '';
    process.env.ALERT_EVENT_API_KEYS = '';
  });

  it('creates an external exceeded alert event with an integration API key', async () => {
    mockedAlertEventsService.createFromIntegration.mockResolvedValue({
      created: true,
      duplicate: false,
      event: alertEventFixture(),
    });

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-integration-key')
      .send(integrationPayload());

    expect(response.status).toBe(201);
    expect(mockedAlertEventsService.createFromIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          'CEMS:S0001:so2:STANDARD_EXCEEDED:2026-03-02T20:00:00+07:00',
        alertType: 'STANDARD_EXCEEDED',
        displaySystemType: 'CEMS',
        thresholdType: 'STANDARD',
        notificationStatus: 'AUTO',
        pointName: 'S0001',
        parameterName: 'SO2',
        parameterLabel: 'SO2 (ppm)',
        startedAt: '2026-03-02T20:00:00+07:00',
        endedAt: '2026-03-02T20:59:59+07:00',
      }),
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        created: true,
        duplicate: false,
        idempotencyKey: 'CEMS:S0001:SO2:STANDARD_EXCEEDED:2026-03-02:20',
      },
    });
  });

  it('returns duplicate metadata when the same idempotency key already exists', async () => {
    mockedAlertEventsService.createFromIntegration.mockResolvedValue({
      created: false,
      duplicate: true,
      event: alertEventFixture(),
    });

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-integration-key')
      .send(integrationPayload());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        created: false,
        duplicate: true,
        idempotencyKey: 'CEMS:S0001:SO2:STANDARD_EXCEEDED:2026-03-02:20',
      },
    });
  });

  it('rejects externally managed alert statuses', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-integration-key')
      .send({
        ...integrationPayload(),
        notificationStatus: 'DISMISSED',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedAlertEventsService.createFromIntegration).not.toHaveBeenCalled();
  });

  it('rejects externally supplied alert types because backend derives them from threshold type', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-integration-key')
      .send({
        ...integrationPayload(),
        alertType: 'STANDARD_EXCEEDED',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedAlertEventsService.createFromIntegration).not.toHaveBeenCalled();
  });

  it('rejects invalid event time ranges', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'test-integration-key')
      .send({
        ...integrationPayload(),
        startTime: '21:00',
        endTime: '20:59',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedAlertEventsService.createFromIntegration).not.toHaveBeenCalled();
  });

  it('accepts alert event scoped API keys', async () => {
    process.env.INTEGRATION_API_KEYS = '';
    process.env.DEVICE_CONFIG_API_KEYS = 'device-config-key';
    process.env.ALERT_EVENT_API_KEYS = 'alert-event-key';
    mockedAlertEventsService.createFromIntegration.mockResolvedValue({
      created: true,
      duplicate: false,
      event: alertEventFixture(),
    });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'alert-event-key')
      .send(integrationPayload());

    expect(response.status).toBe(201);
    expect(mockedAlertEventsService.createFromIntegration).toHaveBeenCalled();
  });

  it('rejects device config scoped API keys for alert event endpoints', async () => {
    process.env.INTEGRATION_API_KEYS = '';
    process.env.DEVICE_CONFIG_API_KEYS = 'device-config-key';
    process.env.ALERT_EVENT_API_KEYS = 'alert-event-key';
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/integrations/alert-events')
      .set('X-API-Key', 'device-config-key')
      .send(integrationPayload());

    expect(response.status).toBe(401);
    expect(mockedAlertEventsService.createFromIntegration).not.toHaveBeenCalled();
  });

  it('lists alert events for authenticated officers', async () => {
    mockedAlertEventsService.list.mockResolvedValue({
      data: [alertEventFixture()],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });

    const app = createApp();
    const response = await request(app)
      .get(
        '/api/v1/alert-events?systemType=CEMS&alertType=STANDARD_EXCEEDED&thresholdType=STANDARD&page=1&pageSize=20',
      )
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedAlertEventsService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        systemType: 'CEMS',
        alertType: 'STANDARD_EXCEEDED',
        thresholdType: 'STANDARD',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(response.body).toMatchObject({
      success: true,
      data: [{ id: 1001, parameterLabel: 'SO2 (ppm)' }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
  });

  it('requires authentication for the frontend list API', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/alert-events?systemType=CEMS');

    expect(response.status).toBe(401);
    expect(mockedAlertEventsService.list).not.toHaveBeenCalled();
  });
});

function integrationPayload() {
  return {
    systemType: 'CEMS',
    stationId: 'S0001',
    pointCode: 'S0001',
    parameterCode: 'so2',
    unit: 'ppm',
    eventDate: '2026-03-02',
    startTime: '20:00',
    endTime: '20:59',
    measuredValue: 150,
    thresholdValue: 60,
    thresholdType: 'STANDARD',
  };
}

function alertEventFixture(): AlertEventDTO {
  return {
    id: 1001,
    idempotencyKey: 'CEMS:S0001:SO2:STANDARD_EXCEEDED:2026-03-02:20',
    alertType: 'STANDARD_EXCEEDED',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'factory-001',
    factoryName: 'บริษัท 2584 จำกัด',
    factoryRegistrationNo: '3-xx-xx',
    stationId: 'S0001',
    pointCode: 'S0001',
    pointName: 'Stack 1',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-03-02',
    eventDateText: '2-Mar-69',
    timeRange: '20.00 - 20.59',
    startedAt: '2026-03-02T20:00:00+07:00',
    endedAt: '2026-03-02T20:59:59+07:00',
    measuredValue: 150,
    thresholdValue: 60,
    thresholdType: 'STANDARD',
    thresholdLabel: 'ค่ามาตรฐาน',
    completenessPercent: null,
    completenessPercentText: null,
    consecutiveDays: null,
    abnormalType: null,
    abnormalLabel: null,
    abnormalStreakCount: null,
    firstAbnormalAt: null,
    confirmedAbnormalAt: null,
    notificationStatus: 'AUTO',
    notificationStatusLabel: 'อัตโนมัติ',
    sourcePayload: null,
    detectedAt: '2026-03-03T08:30:05.000Z',
  };
}

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
