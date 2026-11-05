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
  monitoringPointFormsService: {
    list: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    selectEligible: jest.fn(),
  },
}));

import { env } from '../../src/config/env';
import { authRepository } from '../../src/modules/auth/auth.repository';
import { authRoutes } from '../../src/modules/auth/auth.routes';
import { authService } from '../../src/modules/auth/auth.service';
import { monitoringPointFormsRoutes } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.routes';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import { authenticate } from '../../src/shared/middlewares/authenticate';
import { authorize, getScope, getScopeDetails } from '../../src/shared/middlewares/authorize';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { verifyAccessToken } from '../../src/shared/utils/jwt';

const repository = jest.mocked(authRepository);
const service = jest.mocked(monitoringPointFormsService);
const verify = jest.mocked(verifyAccessToken);
const originalSetting = env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED;
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
const savedView = { scope: 'IN_PROVINCE' as const, province: 'ระยอง' };
const protectedActions = [
  'permissions:manage',
  'cems_wpms_requests:direct_connect',
  'chat:answer',
  'notifications:view_status',
  'dashboard.stats:export',
];

function app() {
  const server = express();
  server.use(express.json());
  server.use('/auth', authRoutes);
  server.use('/monitoring-point-forms', monitoringPointFormsRoutes);
  server.all('/action', authenticate, authorize('cems_wpms_requests:edit'), (req, res) => {
    res.json({
      scope: getScope(req, 'cems_wpms_requests:edit'),
      details: getScopeDetails(req, 'cems_wpms_requests:edit'),
    });
  });
  server.patch('/binary-action', authenticate, authorize('users:edit'), (req, res) => {
    res.json({ scope: getScope(req, 'users:edit') });
  });
  server.get('/context', authenticate, (req, res) => {
    res.json(req.user);
  });
  server.get(
    '/approval-or-view',
    authenticate,
    authorize('cems_wpms_requests:view', 'cems_wpms_requests:approve'),
    (_req, res) => {
      res.sendStatus(204);
    },
  );
  server.post(
    '/view-and-approve',
    authenticate,
    authorize('eligible_factories:view'),
    authorize('eligible_factories:approve'),
    (_req, res) => {
      res.sendStatus(204);
    },
  );
  protectedActions.forEach((permission, index) => {
    server.post(`/protected/${index}`, authenticate, authorize(permission), (_req, res) => {
      res.sendStatus(204);
    });
  });
  server.use(errorHandler);
  return server;
}

describe('officer edit/approve bypass with unchanged reads', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = false;
    verify.mockReturnValue({ sub: '26', userType: 'officer', roles: ['admin'], scopes: {} });
    repository.findUserById.mockResolvedValue(officer);
    repository.getOfficerProfile.mockResolvedValue(undefined);
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      permissionMode: 'custom',
      scopes: { 'cems_wpms_requests:view': savedView },
    });
    service.list.mockResolvedValue([]);
    service.update.mockResolvedValue({ id: 7 } as never);
    service.selectEligible.mockResolvedValue({ id: 7 } as never);
  });

  afterEach(() => {
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = originalSetting;
  });

  it('keeps the view scope and location passed into the real list controller unchanged', async () => {
    const response = await request(app())
      .get('/monitoring-point-forms')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.any(Object), {
      actorUserId: 26,
      scope: savedView,
      regionalAccess: null,
    });
  });

  it('does not add a missing view grant, including read endpoints that also accept approve', async () => {
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      scopes: {},
      permissionMode: 'custom',
    });
    const server = app();
    for (const path of [
      '/monitoring-point-forms',
      '/monitoring-point-forms/7',
      '/approval-or-view',
    ]) {
      const response = await request(server).get(path).set('Authorization', 'Bearer test-token');
      expect({ path, status: response.status }).toEqual({ path, status: 403 });
    }
    expect(service.list).not.toHaveBeenCalled();
    expect(service.getById).not.toHaveBeenCalled();
  });

  it('keeps the full authenticated account context, view qualifiers, and regional access intact', async () => {
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      permissionMode: 'role_default',
      scopes: { 'cems_wpms_requests:view': { scope: 'IN_REGION', region: 'ภาคกลาง' } },
    });
    repository.getOfficerProfile.mockResolvedValue({
      regional_access_json: JSON.stringify({ regions: ['ภาคกลาง'] }),
    } as never);
    const saved = await authService.getAuthorizationContext(26);
    const response = await request(app()).get('/context').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(saved);
    expect(saved.regionalAccess).toEqual({ regions: ['ภาคกลาง'] });
    expect(saved.scopes['cems_wpms_requests:edit']).toBeUndefined();
  });

  it('lets a denied edit reach the real update controller without changing read access', async () => {
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
  });

  it('lets a missing approve grant reach the real select-eligible controller', async () => {
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

  it('still enforces an explicit view guard on a write route', async () => {
    const response = await request(app())
      .post('/view-and-approve')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('eligible_factories:view');
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)('bypasses edit on %s', async (method) => {
    const response = await request(app())
      [method]('/action')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scope: 'ALL', details: { scope: 'ALL' } });
  });

  it.each(['get', 'head'] as const)(
    'does not bypass edit on a read-only %s request',
    async (method) => {
      const response = await request(app())
        [method]('/action')
        .set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(403);
    },
  );

  it.each(protectedActions.map((permission, index) => [permission, index] as const))(
    'keeps %s enforced',
    async (_permission, index) => {
      const response = await request(app())
        .post(`/protected/${index}`)
        .set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(403);
    },
  );

  it('treats a bypassed binary edit scope as a real grant even when its value is null', async () => {
    const response = await request(app())
      .patch('/binary-action')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scope: null });
  });

  it.each(['officer', 'admin'] as const)(
    'applies only to the current trusted %s identity',
    async (userType) => {
      repository.findUserById.mockResolvedValue({ ...officer, user_type: userType });
      const response = await request(app())
        .post('/action')
        .set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(200);
    },
  );

  it.each(['citizen', 'operator'] as const)(
    'keeps %s edit checks despite stale officer token claims',
    async (userType) => {
      repository.findUserById.mockResolvedValue({ ...officer, user_type: userType });
      repository.getRolesAndPermissions.mockResolvedValue({
        roles: [userType === 'operator' ? 'factory_operator' : 'public_user'],
        scopes: {},
        permissionMode: 'custom',
      });
      const response = await request(app())
        .post('/action')
        .set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(403);
    },
  );

  it('preserves saved frontend permissions in login/me', async () => {
    const response = await request(app()).get('/auth/me').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(response.body.permissions.connection).toMatchObject({
      data: 'IN_PROVINCE',
      province: 'ระยอง',
      view: true,
    });
    expect(response.body.permissions.connection.edit).not.toBe(true);
    expect(response.body.permissions.connection.approve).not.toBe(true);
  });

  it('restores write checks when enabled', async () => {
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = true;
    const response = await request(app()).post('/action').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(403);
  });

  it('still requires authentication and active accounts', async () => {
    const unauthenticated = await request(app()).post('/action');
    expect(unauthenticated.status).toBe(401);
    repository.findUserById.mockResolvedValue({ ...officer, is_active: false });
    const disabled = await request(app()).post('/action').set('Authorization', 'Bearer test-token');
    expect(disabled.status).toBe(401);
  });
});
