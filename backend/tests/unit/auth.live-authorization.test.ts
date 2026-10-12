import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/shared/utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
  signAccessToken: jest.fn(() => 'signed-token'),
}));
jest.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserById: jest.fn(),
    getRolesAndPermissions: jest.fn(),
    getRolePermissions: jest.fn(),
    getOfficerProfile: jest.fn(),
    getOperatorProfile: jest.fn(),
    getOperatorFactories: jest.fn(),
  },
}));

import { authRepository } from '../../src/modules/auth/auth.repository';
import { authService } from '../../src/modules/auth/auth.service';
import { authenticate } from '../../src/shared/middlewares/authenticate';
import { authorize } from '../../src/shared/middlewares/authorize';
import { verifyAccessToken } from '../../src/shared/utils/jwt';

const repository = jest.mocked(authRepository);
const verify = jest.mocked(verifyAccessToken);
const currentUser = {
  id: 45,
  external_id: 'current_officer',
  identity_provider: 'local',
  user_type: 'officer' as const,
  username: 'current_officer',
  first_name: 'Test',
  last_name: 'User',
  prename_th: null,
  email: null,
  phone: null,
  is_active: true,
  password_hash: null,
};

async function authenticateRequest() {
  const req = { headers: { authorization: 'Bearer signed-token' } } as Request;
  const next = jest.fn();
  await authenticate(req, {} as Response, next);
  return { req, next };
}

describe('live authorization after editing individual permissions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    verify.mockReturnValue({
      sub: '45',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'factories:view': 'ALL' },
      regionalAccess: { regions: ['ภาคกลาง'] },
    });
    repository.findUserById.mockResolvedValue(currentUser);
    repository.getOfficerProfile.mockResolvedValue(undefined);
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {},
      permissionMode: 'custom',
    } as never);
  });

  it('denies a revoked permission even when an existing token still grants it', async () => {
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith();
    const authorizationNext = jest.fn();
    authorize('factories:view')(req, {} as Response, authorizationNext);
    expect(authorizationNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(req.user?.roles).toEqual(['diw_central']);
  });

  it('allows a newly granted permission without issuing another token', async () => {
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: { 'eligible_factories:edit': null },
      permissionMode: 'custom',
    } as never);
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith();
    const authorizationNext = jest.fn();
    authorize('eligible_factories:edit')(req, {} as Response, authorizationNext);
    expect(authorizationNext).toHaveBeenCalledWith();
  });

  it('uses explicit custom menu locations without profile or role region limits', async () => {
    const scopes = {
      'dashboard:view': { scope: 'ALL' as const },
      'factories:view': { scope: 'IN_PROVINCE' as const, province: 'ระยอง' },
      'eligible_factories:view': { scope: 'IN_ESTATE' as const, estateCode: 'NEW' },
    };
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      scopes,
      permissionMode: 'custom',
    } as never);
    repository.getOfficerProfile.mockResolvedValue({
      province_name_th: 'กรุงเทพมหานคร',
      estate_code: 'OLD',
      regional_access_json: JSON.stringify({ regions: ['ภาคกลาง'] }),
    } as never);
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.scopeDetails).toEqual(scopes);
    expect(req.user?.regionalAccess).toBeNull();
  });

  it('uses the current account type instead of a stale privileged token type', async () => {
    verify.mockReturnValue({ sub: '45', userType: 'admin', roles: ['admin'], scopes: {} });
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.userType).toBe('officer');
    expect(req.user?.roles).toEqual(['diw_central']);
  });

  it('loads current operator permissions without hydrating the factory profile for each request', async () => {
    verify.mockReturnValue({
      sub: '45',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: {},
    });
    repository.findUserById.mockResolvedValue({
      ...currentUser,
      identity_provider: 'i_industry',
      user_type: 'operator',
    });
    repository.getRolePermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: { 'factories:view': 'OWN_FACTORY' },
      permissionMode: 'role_default',
    });
    repository.getOperatorFactories.mockResolvedValue([]);
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.scopes).toEqual({ 'factories:view': 'OWN_FACTORY' });
    expect(repository.getOperatorProfile).not.toHaveBeenCalled();
    expect(repository.getOperatorFactories).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before reading current permissions', async () => {
    verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(repository.findUserById).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it.each([
    ['suspended', { ...currentUser, is_active: false }],
    ['deleted', { ...currentUser, deleted_at: '2026-01-01T00:00:00Z' }],
    ['missing', undefined],
  ])('rejects an existing token for a %s user', async (_label, user) => {
    repository.findUserById.mockResolvedValue(user);
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(req.user).toBeUndefined();
  });

  it.each(['NaN', '0', '-1', '1.5', '9007199254740992'])(
    'rejects the invalid numeric token identity %s before reading authorization',
    async (sub) => {
      verify.mockReturnValue({ sub, userType: 'officer', roles: [], scopes: {} });
      const { next } = await authenticateRequest();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
      expect(repository.findUserById).not.toHaveBeenCalled();
    },
  );

  it('propagates an authorization database failure without trusting old token scopes', async () => {
    const databaseFailure = new Error('authorization database unavailable');
    repository.getRolesAndPermissions.mockRejectedValue(databaseFailure);
    const { req, next } = await authenticateRequest();
    expect(next).toHaveBeenCalledWith(databaseFailure);
    expect(req.user).toBeUndefined();
  });

  it('returns current custom permissions from /me instead of stale session scopes', async () => {
    repository.getRolesAndPermissions.mockResolvedValue({
      roles: ['monitoring_kpm'],
      scopes: { 'eligible_factories:view': 'ALL' },
      permissionMode: 'custom',
    } as never);
    repository.getOfficerProfile.mockResolvedValue({
      regional_access_json: JSON.stringify({ regions: ['ภาคกลาง'] }),
    } as never);
    const result = await authService.me(45, {
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'factories:view': 'IN_REGION' },
    });
    expect(result.permissions.eligible_factories).toMatchObject({ data: 'ALL', view: true });
    expect(result.permissions.factories?.view).not.toBe(true);
    expect(result.user).toMatchObject({ permissionMode: 'custom' });
    expect(result.user.regionalAccess).toBeUndefined();
  });
});
