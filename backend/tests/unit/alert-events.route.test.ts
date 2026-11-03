import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { alertEventsRoutes } from '../../src/modules/alert-events/alert-events.routes';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signTestAccessToken as signAccessToken } from '../helpers/live-authorization-fixture';

jest.mock('../../src/modules/alert-events/alert-events.service', () => ({
  alertEventsService: {
    createFromIntegration: jest.fn(),
    createBatchFromIntegration: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

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
    const [query, actorUserId, viewScope, regionalAccess, canViewStatus] =
      mockedAlertEventsService.list.mock.calls.at(-1) ?? [];
    expect(query).toEqual(
      expect.objectContaining({
        systemType: 'CEMS',
        alertType: 'STANDARD_EXCEEDED',
        thresholdType: 'STANDARD',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(actorUserId).toBe(42);
    expect(viewScope).toEqual({ scope: 'ALL' });
    expect(regionalAccess).toBeNull();
    expect(canViewStatus).toBe(false);
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

  it('rejects an inverted alert event list date range', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/alert-events?dateFrom=2026-03-03&dateTo=2026-03-02')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedAlertEventsService.list).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates in list filters before database lookup', async () => {
    const response = await request(createApp())
      .get('/api/v1/alert-events?dateFrom=2026-04-31')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedAlertEventsService.list).not.toHaveBeenCalled();
  });

  it('uses notification permissions for the frontend alert list route', async () => {
    mockedAlertEventsService.list.mockResolvedValue({
      data: [alertEventFixture()],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/alert-events')
      .set('Authorization', `Bearer ${notificationAccessToken()}`);

    expect(response.status).toBe(200);
    const [query, actorUserId, viewScope, regionalAccess, canViewStatus] =
      mockedAlertEventsService.list.mock.calls.at(-1) ?? [];
    expect(query).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(actorUserId).toBe(42);
    expect(viewScope).toEqual({ scope: 'ALL' });
    expect(regionalAccess).toBeNull();
    expect(canViewStatus).toBe(false);
  });

  it('passes notification status visibility to the service for admin-capable viewers', async () => {
    mockedAlertEventsService.list.mockResolvedValue({
      data: [alertEventFixture()],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/alert-events')
      .set('Authorization', `Bearer ${notificationStatusAccessToken()}`);

    expect(response.status).toBe(200);
    const [query, actorUserId, viewScope, regionalAccess, canViewStatus] =
      mockedAlertEventsService.list.mock.calls.at(-1) ?? [];
    expect(query).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(actorUserId).toBe(42);
    expect(viewScope).toEqual({ scope: 'ALL' });
    expect(regionalAccess).toBeNull();
    expect(canViewStatus).toBe(true);
  });

  it('rejects the frontend alert list route without notifications:view', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/alert-events')
      .set('Authorization', `Bearer ${connectionOnlyAccessToken()}`);

    expect(response.status).toBe(403);
    expect(mockedAlertEventsService.list).not.toHaveBeenCalled();
  });
});

function alertEventFixture(overrides: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id: 1001,
    idempotencyKey: 'CEMS:S0001:so2:STANDARD_EXCEEDED:2026-03-02T20:00:00+07:00',
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
    ...overrides,
  };
}

function accessToken(): string {
  return notificationAccessToken();
}

function notificationAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'notifications:view': 'ALL',
    },
  });
}

function notificationStatusAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'admin',
    roles: ['admin'],
    scopes: {
      'notifications:view': 'ALL',
      'notifications:view_status': 'ALL',
    },
  });
}

function connectionOnlyAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:view': 'ALL',
    },
  });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/alert-events', alertEventsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
