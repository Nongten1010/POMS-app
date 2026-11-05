import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/shared/utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
  signAccessToken: jest.fn(),
}));
jest.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserById: jest.fn(),
    getRolesAndPermissions: jest.fn(),
    getOfficerProfile: jest.fn(),
  },
}));
jest.mock('../../src/modules/monitoring-point-forms/monitoring-point-forms.service', () => ({
  monitoringPointFormsService: { update: jest.fn(), selectEligible: jest.fn() },
}));

import { env } from '../../src/config/env';
import { authRepository } from '../../src/modules/auth/auth.repository';
import { authRoutes } from '../../src/modules/auth/auth.routes';
import { monitoringPointFormsRoutes } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.routes';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import { getChatAccess } from '../../src/modules/chat/chat.access';
import { authenticate } from '../../src/shared/middlewares/authenticate';
import { authorize } from '../../src/shared/middlewares/authorize';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { verifyAccessToken } from '../../src/shared/utils/jwt';

const repository = jest.mocked(authRepository);
const service = jest.mocked(monitoringPointFormsService);
const verify = jest.mocked(verifyAccessToken);
const originalSetting = env.OFFICER_PERMISSION_CHECKS_ENABLED;
const officer = {
  id: 26,
  external_id: 'test-officer',
  identity_provider: 'local',
  user_type: 'officer' as const,
  username: 'test-officer',
  first_name: 'Test',
  last_name: 'Officer',
  prename_th: null,
  email: null,
  phone: null,
  is_active: true,
  password_hash: null,
};

function app() {
  const server = express();
  server.use(express.json());
  server.use('/auth', authRoutes);
  server.use('/monitoring-point-forms', monitoringPointFormsRoutes);
  server.get('/staff-probe', authenticate, authorize('permissions:manage'), (req, res) => {
    res.json({
      canManagePermissions: req.user?.scopes['permissions:manage'] !== undefined,
      chat: getChatAccess(req.user),
    });
  });
  server.use(errorHandler);
  return server;
}

describe('temporary officer API permission policy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.OFFICER_PERMISSION_CHECKS_ENABLED = false;
    verify.mockReturnValue({
      sub: '26',
      userType: 'officer',
      roles: ['admin'],
      scopes: { 'cems_wpms_requests:edit': 'ALL' },
    });
    repository.findUserById.mockResolvedValue(officer);
    repository.getOfficerProfile.mockResolvedValue(undefined);
    // A custom snapshot that omits edit models an effective explicit deny.
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      scopes: { 'eligible_factories:edit': 'IN_REGION' },
      permissionMode: 'custom',
    });
    service.update.mockResolvedValue({ id: 7 } as never);
    service.selectEligible.mockResolvedValue({ id: 7 } as never);
  });

  afterEach(() => {
    env.OFFICER_PERMISSION_CHECKS_ENABLED = originalSetting;
  });

  it('lets a denied officer edit and passes ALL to the real controller/service boundary', async () => {
    const response = await request(app())
      .put('/monitoring-point-forms/7')
      .set('Authorization', 'Bearer test-token')
      .send({ factory: {}, points: [] });

    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(7, expect.any(Object), 26, {
      actorUserId: 26,
      scope: { scope: 'ALL' },
      regionalAccess: null,
    });
    expect(repository.getRolesAndPermissions).toHaveBeenCalledWith(26);
  });

  it('also bypasses other officer actions, rather than only the original edit permission', async () => {
    const response = await request(app())
      .post('/monitoring-point-forms/7/select-eligible')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(201);
    expect(service.selectEligible).toHaveBeenCalledWith(7, 26, {
      actorUserId: 26,
      scope: { scope: 'ALL' },
      regionalAccess: null,
    });
  });

  it.each(['officer', 'admin'] as const)(
    'covers direct permission lookups for %s accounts',
    async (userType) => {
      repository.findUserById.mockResolvedValue({ ...officer, user_type: userType });
      const response = await request(app())
        .get('/staff-probe')
        .set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        canManagePermissions: true,
        chat: { canWrite: true, canCreateTicket: true, factoryScope: { scope: 'ALL' } },
      });
    },
  );

  it('restores denial with the configuration switch enabled', async () => {
    env.OFFICER_PERMISSION_CHECKS_ENABLED = true;
    const response = await request(app())
      .put('/monitoring-point-forms/7')
      .set('Authorization', 'Bearer test-token')
      .send({ factory: {}, points: [] });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe(
      'Missing required permission: cems_wpms_requests:edit',
    );
    expect(service.update).not.toHaveBeenCalled();
  });

  it.each(['citizen', 'operator'] as const)(
    'does not trust stale officer claims for a current %s',
    async (userType) => {
      repository.findUserById.mockResolvedValue({ ...officer, user_type: userType });
      repository.getRolesAndPermissions.mockResolvedValue({
        roles: [userType === 'operator' ? 'factory_operator' : 'public_user'],
        scopes: {},
        permissionMode: 'custom',
      });
      const response = await request(app())
        .put('/monitoring-point-forms/7')
        .set('Authorization', 'Bearer test-token')
        .send({ factory: {}, points: [] });
      expect(response.status).toBe(403);
      expect(service.update).not.toHaveBeenCalled();
    },
  );

  it('keeps saved frontend permissions in /auth/me while API checks are bypassed', async () => {
    const response = await request(app()).get('/auth/me').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(response.body.permissions.eligible_factories).toMatchObject({
      data: 'IN_REGION',
      edit: true,
    });
    expect(response.body.permissions.connection?.edit).not.toBe(true);
    expect(response.body.permissions.permissions?.manage).not.toBe(true);
    expect(response.body.user.permissionMode).toBe('custom');
  });

  it('still requires authentication', async () => {
    const response = await request(app())
      .put('/monitoring-point-forms/7')
      .send({ factory: {}, points: [] });
    expect(response.status).toBe(401);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('still rejects invalid tokens', async () => {
    verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    const response = await request(app())
      .get('/staff-probe')
      .set('Authorization', 'Bearer invalid');
    expect(response.status).toBe(401);
    expect(repository.findUserById).not.toHaveBeenCalled();
  });

  it('still rejects disabled staff accounts', async () => {
    repository.findUserById.mockResolvedValue({ ...officer, is_active: false });
    const response = await request(app())
      .get('/staff-probe')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(401);
  });

  it('still validates the payload after bypassing permissions', async () => {
    const response = await request(app())
      .put('/monitoring-point-forms/7')
      .set('Authorization', 'Bearer test-token')
      .send({ factory: {}, points: [], unexpected: true });
    expect(response.status).toBe(400);
    expect(service.update).not.toHaveBeenCalled();
  });
});
