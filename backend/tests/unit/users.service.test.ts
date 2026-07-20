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
    findPermissionsByCodes: jest.fn(),
    findProvinceByIdOrName: jest.fn(),
    replaceUserPermissionOverrides: jest.fn(),
    getRolePermissions: jest.fn(),
    getUserPermissionOverrides: jest.fn(),
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
    mockedUsersRepository.findById.mockResolvedValue({ id: 44 } as never);
    mockedUsersRepository.findPermissionsByCodes.mockImplementation(async (codes) =>
      codes.map((code, index) => ({
        id: index + 1,
        code,
        resource: code.split(':')[0] ?? code,
        action: code.split(':')[1] ?? 'view',
        description: null,
      })),
    );
    mockedUsersRepository.getRolePermissions.mockResolvedValue([]);
    mockedUsersRepository.getUserPermissionOverrides.mockResolvedValue([]);
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
        },
        {
          code: 'factories:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: null,
          province: null,
        },
      ],
      7,
    );
  });

  it('keeps province and region out of the permission-management user payload', async () => {
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
