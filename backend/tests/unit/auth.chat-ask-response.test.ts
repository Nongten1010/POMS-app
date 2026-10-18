import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/config/env', () => ({ env: { NODE_ENV: 'test' } }));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/shared/utils/jwt', () => ({
  signAccessToken: jest.fn(() => 'fixture-token'),
}));
jest.mock('../../src/shared/utils/password', () => ({
  verifyPassword: jest.fn(async () => true),
  bufferToHashString: jest.fn(() => 'fixture-hash'),
}));
jest.mock('../../src/modules/auth/identity-provider', () => ({ getIdentityProvider: jest.fn() }));
jest.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByProviderAndExternalId: jest.fn(),
    findUserById: jest.fn(),
    updateLastLogin: jest.fn(),
    getOfficerProfile: jest.fn(),
    getRolesAndPermissions: jest.fn(),
  },
}));
jest.mock('../../src/modules/users/users.repository', () => ({
  usersRepository: {
    findById: jest.fn(),
    getRolePermissions: jest.fn(),
    getUserPermissionOverrides: jest.fn(),
  },
}));

import { authRepository } from '../../src/modules/auth/auth.repository';
import { authService } from '../../src/modules/auth/auth.service';
import {
  flattenPermissionScopes,
  mergePermissionScopesWithOverrides,
} from '../../src/modules/auth/permissions';
import type { PermissionMode, PersonaPermissionOverride } from '../../src/modules/auth/permissions';
import { usersRepository } from '../../src/modules/users/users.repository';
import { usersService } from '../../src/modules/users/users.service';
import { signAccessToken } from '../../src/shared/utils/jwt';

const auth = jest.mocked(authRepository);
const users = jest.mocked(usersRepository);
const roleGrants = ['chat:view', 'chat:ask', 'chat:answer'].map((code) => ({
  code,
  scope: 'ALL' as const,
  resource: 'chat',
  action: code.split(':')[1],
  description: null,
}));

describe('Chat ask response consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each<{
    name: string;
    mode: PermissionMode;
    overrides: PersonaPermissionOverride[];
    hasRoleGrants: boolean;
    expected: boolean;
  }>([
    {
      name: 'custom admin deny',
      mode: 'custom',
      overrides: [
        { code: 'chat:view', effect: 'allow', scope: 'ALL' },
        { code: 'chat:answer', effect: 'allow', scope: 'ALL' },
        { code: 'chat:ask', effect: 'deny', scope: null },
      ],
      hasRoleGrants: true,
      expected: false,
    },
    {
      name: 'custom omission',
      mode: 'custom',
      overrides: [{ code: 'chat:view', effect: 'allow', scope: 'ALL' }],
      hasRoleGrants: true,
      expected: false,
    },
    {
      name: 'empty custom snapshot',
      mode: 'custom',
      overrides: [],
      hasRoleGrants: true,
      expected: false,
    },
    {
      name: 'role without Chat grants',
      mode: 'role_default',
      overrides: [],
      hasRoleGrants: false,
      expected: false,
    },
    {
      name: 'role default deny',
      mode: 'role_default',
      overrides: [{ code: 'chat:ask', effect: 'deny', scope: null }],
      hasRoleGrants: true,
      expected: false,
    },
    {
      name: 'role default allow',
      mode: 'role_default',
      overrides: [],
      hasRoleGrants: true,
      expected: true,
    },
    {
      name: 'custom allow',
      mode: 'custom',
      overrides: [{ code: 'chat:ask', effect: 'allow', scope: 'ALL' }],
      hasRoleGrants: true,
      expected: true,
    },
  ])(
    'returns the same boolean for login, me and user detail: $name',
    async ({ mode, overrides, hasRoleGrants, expected }) => {
      const grants = hasRoleGrants ? roleGrants : [];
      const scopes = mergePermissionScopesWithOverrides(grants, overrides, mode);
      const user = {
        id: 7,
        external_id: 'fixture-admin',
        identity_provider: 'local',
        user_type: 'officer',
        username: 'fixture-admin',
        first_name: 'Fixture',
        last_name: 'Admin',
        is_active: true,
        password_hash: Buffer.from('fixture-hash'),
      } as const;
      auth.findUserByProviderAndExternalId.mockResolvedValue(user as never);
      auth.findUserById.mockResolvedValue(user as never);
      auth.getOfficerProfile.mockResolvedValue(undefined);
      auth.getRolesAndPermissions.mockResolvedValue({
        roles: ['admin'],
        permissionMode: mode,
        scopes,
      });
      users.findById.mockResolvedValue({
        id: 7,
        username: user.username,
        firstName: 'Fixture',
        lastName: 'Admin',
        identityProvider: 'local',
        roles: 'admin',
        roleCodes: ['admin'],
        permissionMode: mode,
      } as never);
      users.getRolePermissions.mockResolvedValue(grants as never);
      users.getUserPermissionOverrides.mockResolvedValue(overrides as never);

      const login = await authService.login({
        accountType: 'poms',
        userType: 'officer',
        username: user.username,
        password: user.username,
      });
      const me = await authService.me(7);
      const detail = await usersService.getAuthDetailById(7);

      for (const response of [login, me, detail]) {
        expect(response.user.permissionMode).toBe(mode);
        expect(response.permissions.chat).toHaveProperty('ask', expected);
      }
      expect(signAccessToken).toHaveBeenCalledTimes(1);
      const tokenPayload = jest.mocked(signAccessToken).mock.calls[0]?.[0];
      expect(tokenPayload?.scopes).toEqual(flattenPermissionScopes(scopes));
      if (expected) {
        expect(tokenPayload?.scopes).toHaveProperty('chat:ask', 'ALL');
      } else {
        expect(tokenPayload?.scopes).not.toHaveProperty('chat:ask');
      }
    },
  );
});
