import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { NotFoundError } from '../../src/shared/errors/AppError';

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    testConnection: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';

const mockedService = jest.mocked(deviceConnectionsService);

describe('device connection routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.list.mockResolvedValue([]);
  });

  it('does not expose list or detail endpoints publicly', async () => {
    const listResponse = await request(createApp()).get('/api/v1/device-connections');
    const detailResponse = await request(createApp()).get('/api/v1/device-connections/1');

    expect(listResponse.status).toBe(401);
    expect(detailResponse.status).toBe(401);
    expect(mockedService.list).not.toHaveBeenCalled();
    expect(mockedService.getById).not.toHaveBeenCalled();
  });

  it('requires cems_wpms_requests:view for reads and forwards its location scope', async () => {
    const forbiddenResponse = await request(createApp())
      .get('/api/v1/device-connections')
      .set('Authorization', `Bearer ${token({ 'cems_wpms_requests:edit': 'ALL' })}`);
    expect(forbiddenResponse.status).toBe(403);

    const response = await request(createApp())
      .get('/api/v1/device-connections?stationId=S0001')
      .set(
        'Authorization',
        `Bearer ${token(
          { 'cems_wpms_requests:view': 'IN_REGION' },
          {
            'cems_wpms_requests:view': { scope: 'IN_REGION' },
          },
          { regions: ['ภาคเหนือ'] },
        )}`,
      );

    expect(response.status).toBe(200);
    expect(mockedService.list).toHaveBeenCalledWith(
      { stationId: 'S0001' },
      {
        actorUserId: 42,
        scope: { scope: 'IN_REGION' },
        regionalAccess: { regions: ['ภาคเหนือ'] },
      },
    );
  });

  it('returns 404 when an authenticated scoped reader cannot access the config', async () => {
    mockedService.getById.mockRejectedValue(new NotFoundError('Device connection config not found'));

    const response = await request(createApp())
      .get('/api/v1/device-connections/99')
      .set('Authorization', `Bearer ${token({ 'cems_wpms_requests:view': 'OWN_FACTORY' })}`);

    expect(response.status).toBe(404);
    expect(mockedService.getById).toHaveBeenCalledWith(99, {
      actorUserId: 42,
      scope: { scope: 'OWN_FACTORY' },
      regionalAccess: null,
    });
  });

  it('uses the edit scope for create and connection-test actions', async () => {
    mockedService.create.mockResolvedValue({ id: 7, stationId: 'S0001' } as never);
    mockedService.testConnection.mockResolvedValue({ success: true } as never);
    const editToken = token(
      { 'cems_wpms_requests:edit': 'IN_PROVINCE' },
      {
        'cems_wpms_requests:edit': { scope: 'IN_PROVINCE', province: 'เชียงใหม่' },
      },
    );
    const payload = {
      stationId: 'S0001',
      protocol: 'POMS_BOX',
      settings: {},
      channels: [],
    };

    const createResponse = await request(createApp())
      .post('/api/v1/device-connections')
      .set('Authorization', `Bearer ${editToken}`)
      .send(payload);
    const testResponse = await request(createApp())
      .post('/api/v1/device-connections/test-connection')
      .set('Authorization', `Bearer ${editToken}`)
      .send(payload);

    const access = {
      actorUserId: 42,
      scope: { scope: 'IN_PROVINCE' as const, province: 'เชียงใหม่' },
      regionalAccess: null,
    };
    expect(createResponse.status).toBe(201);
    expect(testResponse.status).toBe(200);
    expect(mockedService.create).toHaveBeenCalledWith(expect.objectContaining(payload), 42, access);
    expect(mockedService.testConnection).toHaveBeenCalledWith(expect.objectContaining(payload), access);
  });
});

function token(
  scopes: Record<string, string | null>,
  scopeDetails?: Record<string, { scope: string; region?: string; province?: string }>,
  regionalAccess?: { regions: string[] },
): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['monitoring_5_centers'],
    scopes,
    scopeDetails: scopeDetails as never,
    regionalAccess,
  });
}
