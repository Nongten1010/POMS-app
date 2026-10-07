import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/shared/utils/password', () => ({ hashPassword: jest.fn() }));
jest.mock('../../src/modules/users/users.repository', () => ({
  usersRepository: {
    findById: jest.fn(),
    findRolesByCodes: jest.fn(),
    findPermissionsByCodes: jest.fn(),
    getRolePermissionsByRoleCodes: jest.fn(),
    getRolePermissions: jest.fn(),
    getUserPermissionOverrides: jest.fn(),
    findProvinceByIdOrName: jest.fn(),
    findIndustrialEstateByCodeOrName: jest.fn(),
    update: jest.fn(),
    replaceUserPermissionOverrides: jest.fn(),
  },
}));

import { usersRepository } from '../../src/modules/users/users.repository';
import { usersService } from '../../src/modules/users/users.service';
import { usersController } from '../../src/modules/users/users.controller';
import { updateManagedUserSchema } from '../../src/modules/users/users.validator';

const repo = jest.mocked(usersRepository);
const grants = [
  { code: 'dashboard:view', resource: 'dashboard', action: 'view', scope: 'ALL' },
  { code: 'factories:view', resource: 'factories', action: 'view', scope: 'ALL' },
  { code: 'eligible_factories:view', resource: 'eligible_factories', action: 'view', scope: 'ALL' },
] as never;
const payload = () => ({
  user: {
    accountType: 'api',
    source: 'api',
    username: 'fixture_officer',
    fullName: 'Test User',
    roleCodes: ['diw_central'],
    isActive: true,
  },
  permissions: {
    dashboard: { data: 'IN_REGION', region: 'ภาคตะวันออก', view: true },
    factories: { data: 'IN_PROVINCE', province: 'ระยอง', view: true },
  },
});

describe('per-menu location assignments', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    repo.findById.mockResolvedValue({
      id: 45,
      username: 'fixture_officer',
      externalId: 'fixture_officer',
      identityProvider: 'diw_dpis',
      roleCodes: ['diw_central'],
      roles: 'diw_central',
      prenameTh: null,
      firstName: 'Test',
      lastName: 'User',
      profile: {
        regionalAccess: { regions: ['ภาคกลาง'] },
        provinceId: '10',
        provinceName: 'กรุงเทพมหานคร',
        estateCode: 'OLD',
      },
    } as never);
    repo.findRolesByCodes.mockResolvedValue([{ code: 'diw_central' }] as never);
    repo.findPermissionsByCodes.mockImplementation(
      async (codes) => codes.map((code) => ({ code })) as never,
    );
    repo.getRolePermissionsByRoleCodes.mockResolvedValue(grants);
    repo.getRolePermissions.mockResolvedValue(grants);
    repo.getUserPermissionOverrides.mockResolvedValue([]);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    repo.findIndustrialEstateByCodeOrName.mockResolvedValue({
      code: 'NEW',
      name_th: 'Test estate',
    } as never);
    repo.update.mockResolvedValue({ id: 45 } as never);
  });

  it.each([null, { regions: ['ภาคกลาง'] }])(
    'saves the API edit-page locations with profile region %j',
    async (regionalAccess) => {
      const existing = await repo.findById(45);
      repo.findById.mockResolvedValue({
        ...existing,
        profile: { ...existing?.profile, regionalAccess },
      } as never);
      await usersService.update(45, updateManagedUserSchema.parse(payload()), 7);
      expect(repo.update).toHaveBeenCalledWith(
        45,
        expect.objectContaining({
          permissionOverrides: expect.arrayContaining([
            expect.objectContaining({
              code: 'dashboard:view',
              scope: 'IN_REGION',
              region: 'ภาคตะวันออก',
            }),
            expect.objectContaining({
              code: 'factories:view',
              scope: 'IN_PROVINCE',
              province: '21',
            }),
          ]),
        }),
        7,
      );
      expect(repo.update.mock.calls[0][1].profile).toBeUndefined();
    },
  );

  it('saves a menu estate independently and resolves its canonical code', async () => {
    await usersService.replacePermissions(
      45,
      {
        permissions: [
          {
            code: 'eligible_factories:view',
            effect: 'allow',
            scope: 'IN_ESTATE',
            estateCode: 'NEW',
          },
        ],
      },
      7,
    );
    expect(repo.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      45,
      [expect.objectContaining({ estateCode: 'NEW' })],
      7,
    );
  });

  it('returns the saved menu region and province when reopening the editor', async () => {
    repo.getUserPermissionOverrides.mockResolvedValue([
      { code: 'dashboard:view', effect: 'allow', scope: 'IN_REGION', region: 'ภาคตะวันออก' },
      {
        code: 'factories:view',
        effect: 'allow',
        scope: 'IN_PROVINCE',
        provinceName: 'ระยอง',
        provinceId: '21',
      },
    ] as never);
    const result = await usersService.getAuthDetailById(45);
    expect(result.permissions.dashboard).toMatchObject({
      data: 'IN_REGION',
      region: 'ภาคตะวันออก',
    });
    expect(result.permissions.factories).toMatchObject({ data: 'IN_PROVINCE', province: 'ระยอง' });
    expect(result.user.regionalAccess).toEqual({ regions: ['ภาคกลาง'] });
  });

  it('allows an authorized manager to save the edit-page request through the controller', async () => {
    const next = jest.fn();
    const req = {
      params: { id: '45' },
      body: payload(),
      user: { id: 7, scopes: { 'permissions:manage': null } },
    } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    await usersController.update(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(repo.update).toHaveBeenCalled();
  });

  it.each([payload(), { ...payload(), permissions: {} }])(
    'requires permissions:manage when PATCH replaces overrides (%j)',
    async (body) => {
      const next = jest.fn();
      const req = {
        params: { id: '45' },
        body,
        user: { id: 7, scopes: { 'users:edit': null } },
      } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      await usersController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN', statusCode: 403 }),
      );
      expect(repo.findById).not.toHaveBeenCalled();
    },
  );
});
