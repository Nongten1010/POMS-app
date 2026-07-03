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
});
