import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { CONNECTION_REQUEST_STATUS } from '../../src/modules/connection-requests/connection-requests.types';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    cancel: jest.fn(),
  },
}));

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);

describe('POST /api/v1/cems-wpms-requests/:id/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsService.cancel.mockResolvedValue({
      id: 1,
      requestNo: 'CEMS-69-00001',
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      statusLabel: 'ยกเลิก',
      revisionReason: null,
    } as never);
  });

  it('lets an operator cancel an owned request without a reason', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/cancel')
      .set('Authorization', `Bearer ${operatorAccessToken()}`)
      .send({});

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.cancel).toHaveBeenCalledWith(1, { reason: null }, 42);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 1,
        status: CONNECTION_REQUEST_STATUS.CANCELED,
      },
    });
  });

  it('trims a supplied reason and converts whitespace-only text to null', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/cancel')
      .set('Authorization', `Bearer ${operatorAccessToken()}`)
      .send({ reason: '   ' });

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.cancel).toHaveBeenCalledWith(1, { reason: null }, 42);
  });

  it('rejects a reason longer than 1000 characters', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/cancel')
      .set('Authorization', `Bearer ${operatorAccessToken()}`)
      .send({ reason: 'ก'.repeat(1001) });

    expect(response.status).toBe(400);
    expect(mockedConnectionRequestsService.cancel).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/cancel')
      .send({});

    expect(response.status).toBe(401);
    expect(mockedConnectionRequestsService.cancel).not.toHaveBeenCalled();
  });

  it('requires the operator edit permission', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/cancel')
      .set('Authorization', `Bearer ${operatorWithoutEditAccessToken()}`)
      .send({});

    expect(response.status).toBe(403);
    expect(mockedConnectionRequestsService.cancel).not.toHaveBeenCalled();
  });
});

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

function operatorWithoutEditAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {},
  });
}
