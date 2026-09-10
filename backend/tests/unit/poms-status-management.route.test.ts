import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { pomsFactoriesRoutes } from '../../src/modules/poms-factories/poms-factories.routes';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/poms-factories/poms-status-management.service', () => ({
  pomsStatusManagementService: {
    get: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ factoryId: 'F1', measurementPoints: [] }),
    update: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ factoryId: 'F1', measurementPoints: [] }),
  },
}));

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/poms-factories', pomsFactoriesRoutes);
  server.use(notFoundHandler);
  server.use(errorHandler);
  return server;
}
const token = () =>
  signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['admin'],
    scopes: { 'factories:view': 'ALL', 'factories:edit': 'ALL' },
  });
describe('Admin status management', () => {
  it('opens factory/point/parameter status management with a JWT admin role', async () => {
    const res = await request(app())
      .get('/api/v1/poms-factories/F1/status-management')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.factoryId).toBe('F1');
  });
});

import { pomsStatusManagementService } from '../../src/modules/poms-factories/poms-status-management.service';
const mocked = jest.mocked(pomsStatusManagementService);
const authToken = (
  roles: string[],
  scopes: Record<string, string | null>,
  userType: 'officer' | 'admin' = 'officer',
) => signAccessToken({ sub: '42', userType, roles, scopes });
const patch = { expectedRevision: 0, reason: 'ตรวจสอบสถานะ', factory: { visibility: 'HIDDEN' } };
describe('Status management authorization and validation', () => {
  it('requires authentication for reads and writes', async () => {
    expect((await request(app()).get('/api/v1/poms-factories/F1/status-management')).status).toBe(
      401,
    );
    expect(
      (await request(app()).patch('/api/v1/poms-factories/F1/status-management').send(patch))
        .status,
    ).toBe(401);
  });
  it.each(['officer', 'admin'] as const)(
    'rejects userType=%s without a JWT admin role despite ALL scopes',
    async (userType) => {
      const auth = authToken(
        ['monitoring_kpm'],
        { 'factories:view': 'ALL', 'factories:edit': 'ALL' },
        userType,
      );
      expect(
        (
          await request(app())
            .get('/api/v1/poms-factories/F1/status-management')
            .set('Authorization', `Bearer ${auth}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app())
            .patch('/api/v1/poms-factories/F1/status-management')
            .set('Authorization', `Bearer ${auth}`)
            .send(patch)
        ).status,
      ).toBe(403);
    },
  );
  it.each<Record<string, string>>([{ 'factories:view': 'ALL' }, { 'factories:edit': 'ALL' }])(
    'requires both view and edit permissions on writes',
    async (scopes) => {
      const auth = authToken(['admin'], scopes);
      expect(
        (
          await request(app())
            .patch('/api/v1/poms-factories/F1/status-management')
            .set('Authorization', `Bearer ${auth}`)
            .send(patch)
        ).status,
      ).toBe(403);
    },
  );
  it('saves all three levels through one PATCH using trusted identity', async () => {
    mocked.update.mockClear();
    const body = {
      ...patch,
      measurementPoints: [
        {
          connectedPointId: 12,
          connectionStatus: 'DISCONNECTED',
          parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }],
        },
      ],
    };
    const res = await request(app())
      .patch('/api/v1/poms-factories/F1/status-management')
      .set('Authorization', `Bearer ${token()}`)
      .send(body);
    expect(res.status).toBe(200);
    expect(mocked.update).toHaveBeenCalledWith(
      'F1',
      { actorUserId: 42, roles: ['admin'], scope: { scope: 'ALL' }, regionalAccess: null },
      expect.objectContaining(body),
    );
  });
  it.each([
    {},
    { ...patch, expectedRevision: -1 },
    { ...patch, reason: ' ' },
    { ...patch, factory: {} },
    { ...patch, actorUserId: 99 },
    { ...patch, factory: { visibility: 'whatever' } },
    {
      ...patch,
      measurementPoints: [
        {
          connectedPointId: 1,
          parameters: [{ parameter: 'CO', visibility: 'HIDDEN', connectionStatus: 'DISCONNECTED' }],
        },
      ],
    },
    {
      ...patch,
      measurementPoints: [
        { connectedPointId: 1, visibility: 'HIDDEN' },
        { connectedPointId: 1, visibility: 'VISIBLE' },
      ],
    },
    {
      ...patch,
      measurementPoints: [
        {
          connectedPointId: 1,
          parameters: [
            { parameter: 'CO', visibility: 'HIDDEN' },
            { parameter: 'co', visibility: 'VISIBLE' },
          ],
        },
      ],
    },
  ])('rejects malformed or ambiguous updates without saving', async (body) => {
    mocked.update.mockClear();
    const res = await request(app())
      .patch('/api/v1/poms-factories/F1/status-management')
      .set('Authorization', `Bearer ${token()}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(mocked.update).not.toHaveBeenCalled();
  });
});
