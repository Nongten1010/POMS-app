import { randomUUID } from 'node:crypto';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../src/shared/utils/password', () => ({
  hashPassword: jest.fn(async () => Buffer.from('hashed-password')),
}));

jest.mock('../../src/modules/users/users.repository', () => ({
  usersRepository: {
    list: jest.fn(),
    findById: jest.fn(),
    findByExternalId: jest.fn(),
    findRolesByCodes: jest.fn(),
    getRolePermissionsByRoleCodes: jest.fn(),
    findPermissionsByCodes: jest.fn(),
    findProvinceByIdOrName: jest.fn(),
    findIndustrialEstateByCodeOrName: jest.fn(),
    replaceUserPermissionOverrides: jest.fn(),
    getRolePermissions: jest.fn(),
    getUserPermissionOverrides: jest.fn(),
    create: jest.fn(),
    createLocalAccount: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  },
}));

import { usersRepository } from '../../src/modules/users/users.repository';
import { usersService } from '../../src/modules/users/users.service';

const mockedUsersRepository = jest.mocked(usersRepository);

import type { Request, Response } from 'express';
import { usersController } from '../../src/modules/users/users.controller';
import { updateManagedUserSchema } from '../../src/modules/users/users.validator';
const repo = mockedUsersRepository;
const grant = (code: string, scope: string | null) => ({
  code,
  scope,
  resource: code.split(':')[0],
  action: code.split(':')[1],
  description: null,
  region: null,
  provinceId: null,
  provinceName: null,
});
describe('custom user permission snapshots', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    repo.findById.mockResolvedValue({
      id: 44,
      username: 'example',
      externalId: 'example',
      firstName: 'Example',
      lastName: '',
      roleCodes: ['diw_central'],
      roles: 'diw_central',
      permissionMode: 'role_default',
      identityProvider: 'diw_dpis',
      profile: { regionalAccess: { regions: ['ภาคกลาง'] } },
    } as never);
    repo.findRolesByCodes.mockResolvedValue([{ code: 'diw_central' }] as never);
    repo.findPermissionsByCodes.mockImplementation(
      async (codes) => codes.map((code) => ({ code })) as never,
    );
    repo.getRolePermissions.mockResolvedValue([grant('factories:view', 'OWN_FACTORY')] as never);
    repo.getRolePermissionsByRoleCodes.mockResolvedValue([
      grant('factories:view', 'OWN_FACTORY'),
    ] as never);
    repo.getUserPermissionOverrides.mockResolvedValue([]);
    repo.update.mockResolvedValue({ id: 44 } as never);
  });
  it('saves scoped Chat independently and replaces the formerly hidden ask grant with an explicit deny', async () => {
    repo.getRolePermissions.mockResolvedValue([
      grant('chat:view', 'ALL'),
      grant('chat:ask', 'ALL'),
    ] as never);
    repo.getRolePermissionsByRoleCodes.mockResolvedValue([
      grant('chat:view', 'ALL'),
      grant('chat:ask', 'ALL'),
    ] as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: {
        chat: { data: 'IN_PROVINCE', province: 'ระยอง', view: true, ask: false, edit: true },
      },
    });

    await usersService.update(44, input, 7);

    const saved = repo.update.mock.calls[0][1];
    expect(saved.permissionMode).toBe('custom');
    expect(saved.permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'chat:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          province: '21',
        }),
        expect.objectContaining({ code: 'chat:ask', effect: 'deny' }),
        expect.objectContaining({
          code: 'chat:answer',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          province: '21',
        }),
      ]),
    );
    expect(
      saved.permissionOverrides?.filter((permission) => permission.code === 'chat:ask'),
    ).toHaveLength(1);
    expect(
      saved.permissionOverrides?.some(
        (permission) => permission.code === 'eligible_factories:view',
      ),
    ).toBe(false);
  });

  it('does not preserve ask when it is omitted from the replacement Chat matrix', async () => {
    repo.getRolePermissions.mockResolvedValue([grant('chat:ask', 'ALL')] as never);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: { chat: { data: 'ALL', view: true } },
    });
    await usersService.update(44, input, 7);
    expect(
      repo.update.mock.calls[0][1].permissionOverrides?.some(
        (permission) => permission.code === 'chat:ask',
      ),
    ).toBe(false);
  });

  it('saves a permission absent from the role rather than the screenshot error', async () => {
    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'chat:answer', effect: 'allow', scope: 'ALL' }] },
        7,
      ),
    ).resolves.toBeDefined();
    expect(repo.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      44,
      expect.arrayContaining([expect.objectContaining({ code: 'chat:answer', effect: 'allow' })]),
      7,
    );
  });
  it('saves ALL beyond the original OWN_FACTORY scope', async () => {
    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'factories:view', effect: 'allow', scope: 'ALL' }] },
        7,
      ),
    ).resolves.toBeDefined();
    expect(repo.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      44,
      expect.arrayContaining([expect.objectContaining({ code: 'factories:view', scope: 'ALL' })]),
      7,
    );
  });
  it('preserves effective hidden grants while replacing editable matrix', async () => {
    repo.getRolePermissions.mockResolvedValue([
      grant('factories:view', 'ALL'),
      grant('permissions:manage', null),
    ] as never);
    repo.getRolePermissionsByRoleCodes.mockResolvedValue([
      grant('factories:view', 'ALL'),
      grant('permissions:manage', null),
    ] as never);
    await usersService.update(
      44,
      { permissionOverrides: [{ code: 'chat:answer', effect: 'allow', scope: 'ALL' }] },
      7,
    );
    expect(repo.update).toHaveBeenCalledWith(
      44,
      expect.objectContaining({
        permissionMode: 'custom',
        permissionOverrides: expect.arrayContaining([
          expect.objectContaining({ code: 'permissions:manage', effect: 'allow' }),
        ]),
      }),
      7,
    );
    expect(repo.update.mock.calls[0][1].permissionOverrides).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:view', effect: 'allow' }),
      ]),
    );
  });
  it('custom reads ignore role grants and use the saved snapshot only', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('chat:answer', 'ALL'), effect: 'allow' },
    ] as never);
    const result = await usersService.getPermissions(44);
    expect(result.effectiveScopes).toEqual({ 'chat:answer': 'ALL' });
    expect(result).toHaveProperty('permissionMode', 'custom');
  });
  it('resetting restores role mode through an explicit PATCH', async () => {
    const input = updateManagedUserSchema.parse({ permissionMode: 'role_default' });
    await usersService.update(44, input, 7);
    expect(repo.update).toHaveBeenCalledWith(
      44,
      expect.objectContaining({ permissionMode: 'role_default' }),
      7,
    );
  });
  it('rejects reset combined with a permission replacement', () => {
    expect(
      updateManagedUserSchema.safeParse({ permissionMode: 'role_default', permissionOverrides: [] })
        .success,
    ).toBe(false);
  });
  it('rejects custom mode without a submitted snapshot', () => {
    expect(updateManagedUserSchema.safeParse({ permissionMode: 'custom' }).success).toBe(false);
  });
  it('does not give new data actions an unspecified scope', async () => {
    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'eligible_factories:view', effect: 'allow' }] },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(repo.replaceUserPermissionOverrides).not.toHaveBeenCalled();
  });
  it.each(['kwp_forms:view', 'bod_cod_errors:view', 'factories:edit'])(
    'rejects explicit null data scope even when the role already grants %s',
    async (code) => {
      repo.getRolePermissions.mockResolvedValue([grant(code, 'ALL')] as never);
      repo.getRolePermissionsByRoleCodes.mockResolvedValue([grant(code, 'ALL')] as never);
      const permissions = [{ code, effect: 'allow' as const, scope: null }];
      await expect(usersService.replacePermissions(44, { permissions }, 7)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(
        usersService.update(44, { permissionOverrides: permissions }, 7),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(repo.replaceUserPermissionOverrides).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    },
  );
  it('freezes an omitted legacy action scope from the role view area once at save time', async () => {
    const grants = [grant('kwp_forms:view', 'IN_PROVINCE'), grant('kwp_forms:edit', null)];
    repo.getRolePermissions.mockResolvedValue(grants as never);
    repo.getRolePermissionsByRoleCodes.mockResolvedValue(grants as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    await usersService.replacePermissions(
      44,
      { permissions: [{ code: 'kwp_forms:edit', effect: 'allow', province: 'ระยอง' }] },
      7,
    );
    expect(repo.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      44,
      expect.arrayContaining([
        expect.objectContaining({ code: 'kwp_forms:edit', scope: 'IN_PROVINCE', province: '21' }),
      ]),
      7,
    );
  });
  it('rejects an omitted data scope when the role has no usable view default', async () => {
    repo.getRolePermissions.mockResolvedValue([grant('kwp_forms:edit', null)] as never);
    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'kwp_forms:edit', effect: 'allow' }] },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(repo.replaceUserPermissionOverrides).not.toHaveBeenCalled();
  });
  it.each(['IN_REGION', 'IN_PROVINCE', 'IN_ESTATE'] as const)(
    'rejects an unresolved %s location instead of saving an unusable permission',
    async (scope) => {
      const user = await repo.findById(44);
      repo.findById.mockResolvedValue({ ...user, profile: {} } as never);
      const permissions = [{ code: 'kwp_forms:view', effect: 'allow' as const, scope }];
      await expect(usersService.replacePermissions(44, { permissions }, 7)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(
        usersService.update(44, { permissionOverrides: permissions }, 7),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(repo.replaceUserPermissionOverrides).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    },
  );
  it('keeps custom hidden grants even after the account changes roles', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('permissions:manage', null), effect: 'allow' },
    ] as never);
    await usersService.update(
      44,
      { permissionOverrides: [{ code: 'chat:answer', effect: 'allow', scope: 'ALL' }] },
      7,
    );
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'permissions:manage', effect: 'allow' }),
      ]),
    );
  });
  it('changing role alone does not reset a custom snapshot or demand role location assignments', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom', profile: {} } as never);
    repo.findRolesByCodes.mockResolvedValue([{ code: 'provincial_office' }] as never);
    await usersService.update(44, { roleCodes: ['provincial_office'] }, 7);
    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('permissionOverrides');
    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('permissionMode');
  });
  it('users:edit alone cannot reset a snapshot back to role grants', async () => {
    const next = jest.fn();
    await usersController.update(
      {
        params: { id: '44' },
        body: { permissionMode: 'role_default' },
        user: { id: 7, scopes: { 'users:edit': null } },
      } as unknown as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('users:edit alone cannot create an explicit custom empty snapshot', async () => {
    const next = jest.fn();
    await usersController.createLocalAccount(
      {
        body: {
          user: {
            fullName: 'Example',
            username: 'example',
            password: randomUUID(),
            roleCodes: ['diw_central'],
          },
          permissions: {},
        },
        user: { id: 7, scopes: { 'users:edit': null } },
      } as unknown as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(repo.createLocalAccount).not.toHaveBeenCalled();
  });
  it('accepts echoed mode as metadata without cancelling permission edits', () => {
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
        permissionMode: 'role_default',
      },
      permissions: { chat: { data: 'ALL', view: true } },
    });
    expect(input.permissionOverrides).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'chat:view', effect: 'allow' })]),
    );
    expect(input.permissionMode).toBeUndefined();
  });
  it('an unchanged grouped editor roundtrip does not widen a narrower action scope', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('factories:view', 'ALL'), effect: 'allow' },
      {
        ...grant('factories:approve', 'IN_PROVINCE'),
        provinceId: '21',
        provinceName: 'ระยอง',
        effect: 'allow',
      },
    ] as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    const edit = await usersService.getAuthDetailById(44);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: edit.permissions,
    });
    await usersService.update(44, input, 7);
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'factories:approve',
          scope: 'IN_PROVINCE',
          province: '21',
        }),
      ]),
    );
  });
  it('retains the selected per-menu estate across a GET and PATCH', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({
      ...user,
      permissionMode: 'custom',
      profile: { estateCode: 'OLD' },
    } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('factories:view', 'IN_ESTATE'), estateCode: 'NEW', effect: 'allow' },
    ] as never);
    repo.findIndustrialEstateByCodeOrName.mockResolvedValue({
      code: 'NEW',
      name_th: 'New estate',
    } as never);
    const edit = await usersService.getAuthDetailById(44);
    expect(edit.permissions.factories).toHaveProperty('estateCode', 'NEW');
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: edit.permissions,
    });
    await usersService.update(44, input, 7);
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:view', estateCode: 'NEW' }),
      ]),
    );
  });
  it('does not widen a narrower Chat answer scope when the grouped form is saved unchanged', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('chat:view', 'ALL'), effect: 'allow' },
      { ...grant('chat:ask', 'IN_REGION'), region: 'ภาคตะวันออก', effect: 'allow' },
      {
        ...grant('chat:answer', 'IN_PROVINCE'),
        provinceId: '21',
        provinceName: 'ระยอง',
        effect: 'allow',
      },
    ] as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    const edit = await usersService.getAuthDetailById(44);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: edit.permissions,
    });

    await usersService.update(44, input, 7);

    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'chat:view', scope: 'ALL' }),
        expect.objectContaining({ code: 'chat:ask', scope: 'IN_REGION', region: 'ภาคตะวันออก' }),
        expect.objectContaining({ code: 'chat:answer', scope: 'IN_PROVINCE', province: '21' }),
      ]),
    );
  });
  it('uses explicit locations when scope is omitted and inherited at save time', async () => {
    repo.getRolePermissionsByRoleCodes.mockResolvedValue([
      grant('factories:view', 'IN_PROVINCE'),
    ] as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    await usersService.update(
      44,
      { permissionOverrides: [{ code: 'factories:view', effect: 'allow', province: 'ระยอง' }] },
      7,
    );
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:view', scope: 'IN_PROVINCE', province: '21' }),
      ]),
    );
  });
  it('canonical province IDs preserve narrower ownership scope on an unchanged grouped save', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      {
        ...grant('factories:view', 'IN_PROVINCE'),
        provinceId: '21',
        provinceName: 'ระยอง',
        effect: 'allow',
      },
      { ...grant('factories:approve', 'OWN_FACTORY'), effect: 'allow' },
    ] as never);
    repo.findProvinceByIdOrName.mockResolvedValue({ id: '21', name_th: 'ระยอง' } as never);
    const edit = await usersService.getAuthDetailById(44);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: edit.permissions,
    });
    await usersService.update(44, input, 7);
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:approve', scope: 'OWN_FACTORY' }),
      ]),
    );
  });
  it('explicit raw PATCH scopes can intentionally broaden an existing action', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    repo.getUserPermissionOverrides.mockResolvedValue([
      { ...grant('factories:view', 'ALL'), effect: 'allow' },
      { ...grant('factories:approve', 'IN_PROVINCE'), provinceId: '21', effect: 'allow' },
    ] as never);
    const input = updateManagedUserSchema.parse({
      permissionOverrides: [{ code: 'factories:approve', effect: 'allow', scope: 'ALL' }],
    });
    await usersService.update(44, input, 7);
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:approve', scope: 'ALL' }),
      ]),
    );
  });
  it('duplicate raw PATCH codes fail validation instead of a database key error', () => {
    expect(
      updateManagedUserSchema.safeParse({
        permissionOverrides: [
          { code: 'chat:view', effect: 'allow', scope: null },
          { code: 'chat:view', effect: 'deny' },
        ],
      }).success,
    ).toBe(false);
  });
  it('equal data scopes with different locations survive an unordered GET and PATCH read', async () => {
    const user = await repo.findById(44);
    repo.findById.mockResolvedValue({ ...user, permissionMode: 'custom' } as never);
    const rows = [
      {
        ...grant('factories:approve', 'IN_PROVINCE'),
        provinceId: '20',
        provinceName: 'ชลบุรี',
        effect: 'allow',
      },
      {
        ...grant('factories:view', 'IN_PROVINCE'),
        provinceId: '21',
        provinceName: 'ระยอง',
        effect: 'allow',
      },
    ];
    repo.getUserPermissionOverrides.mockResolvedValue(rows as never);
    repo.findProvinceByIdOrName.mockImplementation(
      async (value) =>
        ({
          id: ['20', 'ชลบุรี'].includes(value) ? '20' : '21',
          name_th: ['20', 'ชลบุรี'].includes(value) ? 'ชลบุรี' : 'ระยอง',
        }) as never,
    );
    const edit = await usersService.getAuthDetailById(44);
    repo.getUserPermissionOverrides.mockResolvedValue([...rows].reverse() as never);
    const input = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        fullName: 'Example',
        username: 'example',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: edit.permissions,
    });
    await usersService.update(44, input, 7);
    expect(repo.update.mock.calls[0][1].permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'factories:approve',
          scope: 'IN_PROVINCE',
          province: '20',
        }),
        expect.objectContaining({ code: 'factories:view', scope: 'IN_PROVINCE', province: '21' }),
      ]),
    );
  });
});
