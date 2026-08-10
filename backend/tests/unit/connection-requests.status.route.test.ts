import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CONNECTION_REQUEST_STATUS } from '../../src/modules/connection-requests/connection-requests.types';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    changeStatus: jest.fn(),
  },
}));

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);

describe('connection request status route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsService.changeStatus.mockResolvedValue({
      id: 1,
      status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      statusLabel: 'รอโรงงานตั้งค่าอุปกรณ์',
      revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
      officerNote: 'แก้ mapping channel แล้วส่งยืนยันอีกครั้ง',
      connectionDueAt: '2026-06-26T10:00:00.000Z',
      confirmedAt: null,
    } as never);
  });

  it('passes return-to-waiting-connection status changes to the service', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/cems-wpms-requests/1/status')
      .set('Authorization', `Bearer ${officerAccessToken()}`)
      .send({
        action: 'RETURN_TO_WAITING_CONNECTION',
        revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
        officerNote: 'แก้ mapping channel แล้วส่งยืนยันอีกครั้ง',
      });

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.changeStatus).toHaveBeenCalledWith(
      1,
      {
        action: 'RETURN_TO_WAITING_CONNECTION',
        revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
        officerNote: 'แก้ mapping channel แล้วส่งยืนยันอีกครั้ง',
      },
      7,
      { scope: null },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        confirmedAt: null,
      },
    });
  });

  it('requires a revision reason when returning to waiting connection', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/cems-wpms-requests/1/status')
      .set('Authorization', `Bearer ${officerAccessToken()}`)
      .send({
        action: 'RETURN_TO_WAITING_CONNECTION',
      });

    expect(response.status).toBe(400);
    expect(mockedConnectionRequestsService.changeStatus).not.toHaveBeenCalled();
  });

  it('requires approval permission for return-to-waiting-connection status changes', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/cems-wpms-requests/1/status')
      .set('Authorization', `Bearer ${operatorAccessToken()}`)
      .send({
        action: 'RETURN_TO_WAITING_CONNECTION',
        revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
      });

    expect(response.status).toBe(403);
    expect(mockedConnectionRequestsService.changeStatus).not.toHaveBeenCalled();
  });
});

function officerAccessToken(): string {
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:approve': null,
    },
  });
}

function operatorAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'cems_wpms_requests:edit': 'OWN_FACTORY',
    },
  });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
