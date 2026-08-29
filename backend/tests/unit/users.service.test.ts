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

describe('usersService permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsersRepository.findById.mockResolvedValue({
      id: 44,
      roleCodes: ['monitoring_5_centers'],
      roles: 'monitoring_5_centers',
      identityProvider: 'local',
      profile: {
        provinceId: '21',
        provinceName: 'ระยอง',
        estateCode: 'IE01',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    } as never);
    mockedUsersRepository.findPermissionsByCodes.mockImplementation(async (codes) =>
      codes.map((code, index) => ({
        id: index + 1,
        code,
        resource: code.split(':')[0] ?? code,
        action: code.split(':')[1] ?? 'view',
        description: null,
      })),
    );
    mockedUsersRepository.getRolePermissions.mockResolvedValue([
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'ALL',
      },
      {
        code: 'factories:view',
        resource: 'factories',
        action: 'view',
        description: null,
        scope: 'ALL',
      },
      {
        code: 'eligible_factories:view',
        resource: 'eligible_factories',
        action: 'view',
        description: null,
        scope: 'ALL',
      },
    ] as never);
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([]);
    mockedUsersRepository.findIndustrialEstateByCodeOrName.mockResolvedValue(undefined);
  });

  it('returns managed-user pagination metadata', async () => {
    mockedUsersRepository.list.mockResolvedValue({ rows: [], total: 51 });

    const result = await usersService.list({ page: 2, perPage: 25, status: 'all' });

    expect(result).toEqual({
      data: [],
      meta: { total: 51, page: 2, perPage: 25, totalPages: 3 },
    });
  });

  it('returns a managed user by internal resource id', async () => {
    const existing = { id: 44, identityProvider: 'local' } as never;
    mockedUsersRepository.findById.mockResolvedValue(existing);

    await expect(usersService.getById(44)).resolves.toBe(existing);
  });

  it('rejects managed users with more than one system role', async () => {
    await expect(
      usersService.create(
        {
          username: 'multi-role',
          userType: 'officer',
          firstName: 'หลาย',
          lastName: 'บทบาท',
          isActive: true,
          roleCodes: ['monitoring_5_centers', 'center_director'],
        },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(mockedUsersRepository.findRolesByCodes).not.toHaveBeenCalled();
    expect(mockedUsersRepository.create).not.toHaveBeenCalled();
  });

  it('prevents a user from deleting their own account', async () => {
    await expect(usersService.delete(44, 44)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockedUsersRepository.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes another existing managed user', async () => {
    await usersService.delete(44, 7);

    expect(mockedUsersRepository.softDelete).toHaveBeenCalledWith(44, 7);
  });

  it('allows region and province to be null for menu location scopes', async () => {
    await usersService.replacePermissions(
      44,
      {
        permissions: [
          {
            code: 'dashboard:view',
            effect: 'allow',
            scope: 'IN_REGION',
            region: null,
            province: null,
          },
          {
            code: 'factories:view',
            effect: 'allow',
            scope: 'IN_PROVINCE',
            region: null,
            province: null,
          },
        ],
      },
      7,
    );

    expect(mockedUsersRepository.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      44,
      [
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_REGION',
          region: null,
          province: null,
          estateCode: null,
          estate: null,
        },
        {
          code: 'factories:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: null,
          province: null,
          estateCode: null,
          estate: null,
        },
      ],
      7,
    );
  });

  it('canonicalizes estate-scoped permission overrides to estateCode', async () => {
    mockedUsersRepository.findIndustrialEstateByCodeOrName.mockResolvedValue({
      code: 'IE01',
      name_th: 'มาบตาพุด',
    } as never);

    await usersService.replacePermissions(
      44,
      {
        permissions: [
          {
            code: 'eligible_factories:view',
            effect: 'allow',
            scope: 'IN_ESTATE',
            region: 'ภาคตะวันออก',
            province: 'ระยอง',
            estateCode: 'มาบตาพุด',
          },
        ],
      },
      7,
    );

    expect(mockedUsersRepository.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      44,
      [
        {
          code: 'eligible_factories:view',
          effect: 'allow',
          scope: 'IN_ESTATE',
          region: null,
          province: null,
          estateCode: 'IE01',
          estate: 'IE01',
        },
      ],
      7,
    );
  });

  it('rejects unknown estate-scoped permission overrides with a 400 instead of a DB FK error', async () => {
    await expect(
      usersService.replacePermissions(
        44,
        {
          permissions: [
            {
              code: 'eligible_factories:view',
              effect: 'allow',
              scope: 'IN_ESTATE',
              estateCode: 'UNKNOWN',
            },
          ],
        },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(mockedUsersRepository.replaceUserPermissionOverrides).not.toHaveBeenCalled();
  });

  it('rejects permission overrides that widen or invent role permissions', async () => {
    mockedUsersRepository.getRolePermissions.mockResolvedValue([
      {
        code: 'factories:view',
        resource: 'factories',
        action: 'view',
        description: null,
        scope: 'OWN_FACTORY',
      },
    ] as never);

    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'factories:view', effect: 'allow', scope: 'ALL' }] },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      usersService.replacePermissions(
        44,
        { permissions: [{ code: 'chat:answer', effect: 'allow', scope: null }] },
        7,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(mockedUsersRepository.replaceUserPermissionOverrides).not.toHaveBeenCalled();
  });

  it('returns profile region, province, and estate assignments in the permission-management payload', async () => {
    mockedUsersRepository.findById.mockResolvedValue({
      id: 44,
      userType: 'officer',
      externalId: 'local_officer',
      username: 'local_officer',
      identityProvider: 'local',
      prenameTh: null,
      firstName: 'สมชาย ทดสอบ',
      lastName: '',
      email: null,
      phone: null,
      department: 'สำนักงานปลัดกระทรวงอุตสาหกรรม',
      lineNameTh: 'นักวิชาการอุตสาหกรรม',
      levelNameTh: 'ชำนาญการ',
      roles: 'monitoring_5_centers',
      isActive: true,
      status: 'active',
      profile: {
        provinceId: '1021',
        provinceName: 'ระยอง',
        estateCode: 'MTP',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    } as never);
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'IN_REGION',
        region: 'ภาคตะวันออก',
        provinceId: null,
        provinceName: null,
        effect: 'allow',
      },
    ]);
    mockedUsersRepository.getRolePermissions.mockResolvedValue([
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'IN_REGION',
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
      },
    ] as never);

    const result = await usersService.getAuthDetailById(44);

    expect(result.user).toEqual({
      accountType: 'poms',
      identityProvider: 'local',
      userType: 'officer',
      username: 'local_officer',
      fullName: 'สมชาย ทดสอบ',
      department: 'สำนักงานปลัดกระทรวงอุตสาหกรรม',
      lineNameTh: 'นักวิชาการอุตสาหกรรม',
      levelNameTh: 'ชำนาญการ',
      provinceName: 'ระยอง',
      estateCode: 'MTP',
      regionalAccess: { regions: ['ภาคตะวันออก'] },
      roles: 'monitoring_5_centers',
      roleCodes: ['monitoring_5_centers'],
      isActive: true,
      source: 'created',
    });
    expect(result.permissions.dashboard).toMatchObject({
      data: 'IN_REGION',
      region: 'ภาคตะวันออก',
      province: null,
      view: true,
    });
    expect(result.permissions.connection).toEqual({
      data: null,
      region: null,
      province: null,
      view: false,
      edit: false,
      approve: false,
    });
    expect(result.permissions.chat).toEqual({ view: false, edit: false });
    expect(result.permissions.permissions).toEqual({ view: false });
    expect(result.permissions).not.toHaveProperty('api_documentation');
  });

  it('projects profile assignments into role-scoped permission groups for editing', async () => {
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([]);
    mockedUsersRepository.getRolePermissions.mockResolvedValue([
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'IN_REGION',
      },
      {
        code: 'factories:view',
        resource: 'factories',
        action: 'view',
        description: null,
        scope: 'IN_PROVINCE',
      },
      {
        code: 'eligible_factories:view',
        resource: 'eligible_factories',
        action: 'view',
        description: null,
        scope: 'IN_ESTATE',
      },
    ] as never);

    const result = await usersService.getAuthDetailById(44);

    expect(result.permissions.dashboard).toMatchObject({
      data: 'IN_REGION',
      region: 'ภาคตะวันออก',
    });
    expect(result.permissions.factories).toMatchObject({
      data: 'IN_PROVINCE',
      province: 'ระยอง',
    });
    expect(result.permissions.eligible_factories).toMatchObject({
      data: 'IN_ESTATE',
      estateCode: 'IE01',
      estate: 'IE01',
    });
  });

  it('keeps users permission output aligned with auth merge safety for widening, invented allow, and deny', async () => {
    mockedUsersRepository.getRolePermissions.mockResolvedValue([
      {
        code: 'factories:view',
        resource: 'factories',
        action: 'view',
        description: null,
        scope: 'OWN_FACTORY',
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
      },
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'ALL',
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
      },
    ] as never);
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([
      {
        code: 'factories:view',
        resource: 'factories',
        action: 'view',
        description: null,
        scope: 'ALL',
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'allow',
      },
      {
        code: 'chat:answer',
        resource: 'chat',
        action: 'answer',
        description: null,
        scope: null,
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'allow',
      },
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: null,
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'deny',
      },
    ] as never);

    const result = await usersService.getPermissions(44);

    expect(result.effectiveScopes).toEqual({
      'factories:view': 'OWN_FACTORY',
    });
    expect(result.permissions.dashboard).toBeUndefined();
    expect(result.permissions.chat).toBeUndefined();
  });

  it('returns the stored login username instead of a divergent legacy external id', async () => {
    mockedUsersRepository.findById.mockResolvedValue({
      id: 45,
      userType: 'officer',
      externalId: 'legacy-person-key',
      username: 'legacy_login',
      identityProvider: 'officer_dpis',
      prenameTh: null,
      firstName: 'เจ้าหน้าที่',
      lastName: 'ทดสอบ',
      email: null,
      phone: null,
      department: null,
      lineNameTh: null,
      levelNameTh: null,
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never);

    const result = await usersService.getAuthDetailById(45);

    expect(result.user.username).toBe('legacy_login');
  });

  it('rejects changing an API account identity', async () => {
    mockedUsersRepository.findById.mockResolvedValue({
      id: 45,
      userType: 'officer',
      externalId: 'U100',
      username: 'U100',
      identityProvider: 'diw_dpis',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never);

    await expect(usersService.update(45, { username: 'U101' }, 7)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockedUsersRepository.update).not.toHaveBeenCalled();
  });

  it('rejects changing profile data owned by an API identity provider', async () => {
    mockedUsersRepository.findById.mockResolvedValue({
      id: 45,
      userType: 'officer',
      externalId: 'U100',
      username: 'U100',
      identityProvider: 'diw_dpis',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never);

    await expect(
      usersService.update(45, { profile: { departmentId: 'changed' } }, 7),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mockedUsersRepository.update).not.toHaveBeenCalled();
  });

  it('allows authorization-area assignments on an API-managed officer profile', async () => {
    const existing = {
      id: 45,
      userType: 'officer',
      externalId: 'U100',
      username: 'U100',
      identityProvider: 'diw_dpis',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
      profile: {
        provinceId: null,
        provinceName: null,
        estateCode: null,
        regionalAccess: null,
      },
    } as never;
    mockedUsersRepository.findById.mockResolvedValue(existing);
    mockedUsersRepository.findRolesByCodes.mockResolvedValue([
      { id: 8, code: 'monitoring_5_centers', name_th: 'เจ้าหน้าที่ 5 ศูนย์', name_en: 'Center' },
    ]);
    mockedUsersRepository.update.mockResolvedValue(existing);

    await usersService.update(
      45,
      {
        roleCodes: ['monitoring_5_centers'],
        profile: { regionalAccess: { regions: ['ภาคตะวันออก'] } },
      },
      7,
    );

    expect(mockedUsersRepository.update).toHaveBeenCalledWith(
      45,
      expect.objectContaining({
        roleCodes: ['monitoring_5_centers'],
        profile: { regionalAccess: { regions: ['ภาคตะวันออก'] } },
      }),
      7,
    );
  });

  it('preserves hidden permission overrides when the editable matrix is replaced', async () => {
    const existing = {
      id: 45,
      userType: 'officer',
      externalId: 'admin_local',
      username: 'admin_local',
      identityProvider: 'local',
      roles: 'admin',
      roleCodes: ['admin'],
      isActive: true,
      profile: { regionalAccess: { regions: ['ภาคกลาง'] } },
    } as never;
    mockedUsersRepository.findById.mockResolvedValue(existing);
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([
      {
        code: 'cems_wpms_requests:direct_connect',
        resource: 'cems_wpms_requests',
        action: 'direct_connect',
        description: null,
        scope: null,
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'deny',
      },
      {
        code: 'statistics:export',
        resource: 'statistics',
        action: 'export',
        description: null,
        scope: 'IN_REGION',
        region: 'ภาคกลาง',
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'allow',
      },
      {
        code: 'factories:edit',
        resource: 'factories',
        action: 'edit',
        description: null,
        scope: null,
        region: null,
        provinceId: null,
        provinceName: null,
        estateCode: null,
        estate: null,
        effect: 'deny',
      },
    ]);
    mockedUsersRepository.getRolePermissionsByRoleCodes.mockResolvedValue([
      {
        code: 'dashboard:view',
        resource: 'dashboard',
        action: 'view',
        description: null,
        scope: 'ALL',
      },
      {
        code: 'cems_wpms_requests:direct_connect',
        resource: 'cems_wpms_requests',
        action: 'direct_connect',
        description: null,
        scope: 'ALL',
      },
      {
        code: 'statistics:export',
        resource: 'statistics',
        action: 'export',
        description: null,
        scope: 'ALL',
      },
    ] as never);
    mockedUsersRepository.update.mockResolvedValue(existing);

    await usersService.update(
      45,
      {
        permissionOverrides: [{ code: 'dashboard:view', effect: 'allow', scope: 'ALL' }],
      },
      7,
    );

    expect(mockedUsersRepository.update).toHaveBeenCalledWith(
      45,
      expect.objectContaining({
        permissionOverrides: expect.arrayContaining([
          expect.objectContaining({ code: 'dashboard:view', effect: 'allow', scope: 'ALL' }),
          expect.objectContaining({
            code: 'cems_wpms_requests:direct_connect',
            effect: 'deny',
          }),
          expect.objectContaining({
            code: 'statistics:export',
            effect: 'allow',
            scope: 'IN_REGION',
            region: 'ภาคกลาง',
          }),
        ]),
      }),
      7,
    );
    const repositoryInput = mockedUsersRepository.update.mock.calls[0]?.[1];
    expect(repositoryInput?.permissionOverrides).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'factories:edit' })]),
    );
  });

  it('strips unchanged API identity fields from a legacy edit payload', async () => {
    const existing = {
      id: 45,
      userType: 'officer',
      externalId: 'U100',
      username: 'U100',
      identityProvider: 'diw_dpis',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never;
    mockedUsersRepository.findById.mockResolvedValue(existing);
    mockedUsersRepository.findRolesByCodes.mockResolvedValue([
      { id: 1, code: 'diw_central', name_th: 'ส่วนกลาง', name_en: 'Central' },
    ]);
    mockedUsersRepository.update.mockResolvedValue(existing);

    await usersService.update(
      45,
      { username: 'U100', externalId: 'U100', roleCodes: ['diw_central'] },
      7,
    );

    expect(mockedUsersRepository.update).toHaveBeenCalledWith(
      45,
      expect.not.objectContaining({ username: expect.anything(), externalId: expect.anything() }),
      7,
    );
  });

  it('keeps a renamed POMS username and provider-scoped account key in sync', async () => {
    const existing = {
      id: 46,
      userType: 'officer',
      externalId: 'local_old',
      username: 'local_old',
      identityProvider: 'local',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never;
    mockedUsersRepository.findById.mockResolvedValue(existing);
    mockedUsersRepository.findByExternalId.mockResolvedValue(undefined);
    mockedUsersRepository.update.mockResolvedValue(existing);

    await usersService.update(46, { username: 'local_new' }, 7);

    expect(mockedUsersRepository.update).toHaveBeenCalledWith(
      46,
      expect.objectContaining({ username: 'local_new', externalId: 'local_new' }),
      7,
    );
  });

  it('rejects conflicting POMS username and account-key updates', async () => {
    mockedUsersRepository.findById.mockResolvedValue({
      id: 46,
      userType: 'officer',
      externalId: 'local_old',
      username: 'local_old',
      identityProvider: 'local',
      roles: 'diw_central',
      roleCodes: ['diw_central'],
      isActive: true,
    } as never);

    await expect(
      usersService.update(46, { username: 'local_new', externalId: 'different_account_key' }, 7),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mockedUsersRepository.update).not.toHaveBeenCalled();
  });
});
