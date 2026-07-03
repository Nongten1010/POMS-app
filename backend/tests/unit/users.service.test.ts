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
    findById: jest.fn(),
    findPermissionsByCodes: jest.fn(),
    findProvinceByIdOrName: jest.fn(),
    replaceUserPermissionOverrides: jest.fn(),
    getRolePermissions: jest.fn(),
    getUserPermissionOverrides: jest.fn(),
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
      userType: 'officer',
      username: 'local_officer',
      fullName: 'สมชาย ทดสอบ',
      department: 'สำนักงานปลัดกระทรวงอุตสาหกรรม',
      lineNameTh: 'นักวิชาการอุตสาหกรรม',
      levelNameTh: 'ชำนาญการ',
      roles: 'monitoring_5_centers',
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
});
