import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/auth/identity-provider', () => ({
  getIdentityProvider: jest.fn(),
}));

jest.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByProviderAndExternalId: jest.fn(),
    findUserById: jest.fn(),
    updateLastLogin: jest.fn(),
    getOfficerProfile: jest.fn(),
    getOperatorProfile: jest.fn(),
    getOperatorFactories: jest.fn(),
    getRolesAndPermissions: jest.fn(),
    getRolePermissions: jest.fn(),
    upsertExternalOfficerUser: jest.fn(),
    upsertExternalOperatorUser: jest.fn(),
    upsertExternalCitizenUser: jest.fn(),
    syncExternalOfficerProfile: jest.fn(),
    syncExternalOperatorProfile: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { authRepository } from '../../src/modules/auth/auth.repository';
import { getIdentityProvider } from '../../src/modules/auth/identity-provider';
import type { ExternalOperatorProfile } from '../../src/modules/auth/identity-provider/identity-provider.interface';
import type { PermissionScopeDetails } from '../../src/modules/auth/permissions';
import type { UserRow } from '../../src/modules/auth/auth.repository';
import { verifyAccessToken } from '../../src/shared/utils/jwt';

const mockedGetIdentityProvider = jest.mocked(getIdentityProvider);
const mockedAuthRepository = jest.mocked(authRepository);
const passwordField = 'password';
const repositoryBoundary = authRepository as typeof authRepository & {
  getRolePermissions: jest.MockedFunction<
    (
      userId: number,
      roleCode: string,
    ) => Promise<{
      roles: string[];
      scopes: Record<string, string | null | PermissionScopeDetails>;
    }>
  >;
  upsertExternalCitizenUser: jest.MockedFunction<
    (profile: ExternalOperatorProfile) => Promise<UserRow | undefined>
  >;
};

describe('POST /api/v1/auth/login session personas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses citizen permissions when an i-Industry account selects citizen login', async () => {
    const profile = iIndustryProfile();
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    repositoryBoundary.upsertExternalCitizenUser.mockResolvedValue(iIndustryUser());
    repositoryBoundary.getRolePermissions.mockResolvedValue({
      roles: ['public_user'],
      scopes: {
        'dashboard:view': 'ALL',
        'dashboard.alerts:view': null,
        'feedback:submit': null,
        'laws:view': null,
        'faq:view': null,
        'chat:ask': null,
      },
    });

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'citizen',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      accountType: 'api',
      userType: 'citizen',
      username: profile.external_id,
      roles: 'public_user',
      roleCodes: ['public_user'],
    });
    expect(response.body.user).not.toHaveProperty('ownedFactoryIds');
    expect(response.body.permissions).toMatchObject({
      dashboard: { data: 'ALL', view: true, favorite: true },
    });
    expect(response.body.permissions).not.toHaveProperty('factories');
    expect(repositoryBoundary.getRolePermissions).toHaveBeenCalledWith(91, 'public_user');
    expect(verifyAccessToken(response.body.accessToken)).toMatchObject({
      userType: 'citizen',
      roles: ['public_user'],
      scopes: {
        'dashboard:view': 'ALL',
      },
    });
  });

  it('uses operator permissions when the same account selects operator and owns a juristic', async () => {
    const profile = iIndustryProfile();
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    mockedAuthRepository.upsertExternalOperatorUser.mockResolvedValue(iIndustryUser());
    mockedAuthRepository.getOperatorProfile.mockResolvedValue({
      user_id: 91,
      user_code: profile.user_code,
      regis_date: profile.regis_date,
    });
    mockedAuthRepository.getOperatorFactories.mockResolvedValue([]);
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
        'factories:view': 'OWN_FACTORY',
        'cems_wpms_requests:view': 'OWN_FACTORY',
      },
    });
    repositoryBoundary.getRolePermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
        'factories:view': 'OWN_FACTORY',
        'cems_wpms_requests:view': 'OWN_FACTORY',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'operator',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      accountType: 'api',
      userType: 'operator',
      username: profile.external_id,
      roles: 'factory_operator',
      roleCodes: ['factory_operator'],
      ownedFactoryIds: [],
    });
    expect(response.body.permissions).toMatchObject({
      dashboard: { data: 'OWN_FACTORY', view: true },
      factories: { data: 'OWN_FACTORY', view: true },
      connection: { data: 'OWN_FACTORY', view: true },
    });
    expect(repositoryBoundary.getRolePermissions).toHaveBeenCalledWith(91, 'factory_operator');
    expect(verifyAccessToken(response.body.accessToken)).toMatchObject({
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
        'factories:view': 'OWN_FACTORY',
      },
    });
  });

  it('falls back to citizen permissions when operator login has no juristic ownership', async () => {
    const profile = { ...iIndustryProfile(), juristics: [] };
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    repositoryBoundary.upsertExternalCitizenUser.mockResolvedValue(iIndustryUser());
    repositoryBoundary.getRolePermissions.mockResolvedValue({
      roles: ['public_user'],
      scopes: {
        'dashboard:view': 'ALL',
        'dashboard.alerts:view': null,
        'feedback:submit': null,
        'laws:view': null,
        'faq:view': null,
        'chat:ask': null,
      },
    });

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'operator',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      accountType: 'api',
      userType: 'citizen',
      username: profile.external_id,
      roles: 'public_user',
      roleCodes: ['public_user'],
    });
    expect(response.body.user).not.toHaveProperty('ownedFactoryIds');
    expect(response.body.permissions).toMatchObject({
      dashboard: { data: 'ALL', view: true, favorite: true },
    });
    expect(response.body.permissions).not.toHaveProperty('factories');
    expect(repositoryBoundary.getRolePermissions).toHaveBeenCalledWith(91, 'public_user');
    expect(verifyAccessToken(response.body.accessToken)).toMatchObject({
      userType: 'citizen',
      roles: ['public_user'],
      scopes: {
        'dashboard:view': 'ALL',
      },
    });
  });

  it('preserves the selected persona in /auth/me for concurrent citizen and operator sessions', async () => {
    const profile = iIndustryProfile();
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    repositoryBoundary.upsertExternalCitizenUser.mockResolvedValue(iIndustryUser());
    mockedAuthRepository.upsertExternalOperatorUser.mockResolvedValue(iIndustryUser());
    repositoryBoundary.getRolePermissions
      .mockResolvedValueOnce({
        roles: ['public_user'],
        scopes: {
          'dashboard:view': 'ALL',
          'dashboard.alerts:view': null,
          'feedback:submit': null,
          'laws:view': null,
          'faq:view': null,
          'chat:ask': null,
        },
      })
      .mockResolvedValueOnce({
        roles: ['factory_operator'],
        scopes: {
          'dashboard:view': 'OWN_FACTORY',
          'factories:view': 'OWN_FACTORY',
          'cems_wpms_requests:view': 'OWN_FACTORY',
        },
      });
    mockedAuthRepository.getOperatorProfile.mockResolvedValue({
      user_id: 91,
      user_code: profile.user_code,
      regis_date: profile.regis_date,
    });
    mockedAuthRepository.getOperatorFactories.mockResolvedValue([]);
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
        'factories:view': 'OWN_FACTORY',
        'cems_wpms_requests:view': 'OWN_FACTORY',
      },
    });
    mockedAuthRepository.findUserById.mockResolvedValue(iIndustryUser());

    const citizenLogin = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'citizen',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });
    const operatorLogin = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'operator',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    const citizenMe = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${citizenLogin.body.accessToken}`);
    const operatorMe = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${operatorLogin.body.accessToken}`);

    expect(citizenMe.status).toBe(200);
    expect(citizenMe.body.user).toMatchObject({
      userType: 'citizen',
      roles: 'public_user',
      roleCodes: ['public_user'],
    });
    expect(citizenMe.body.user).not.toHaveProperty('ownedFactoryIds');
    expect(citizenMe.body.permissions).not.toHaveProperty('factories');

    expect(operatorMe.status).toBe(200);
    expect(operatorMe.body.user).toMatchObject({
      userType: 'operator',
      roles: 'factory_operator',
      roleCodes: ['factory_operator'],
      ownedFactoryIds: [],
    });
    expect(operatorMe.body.permissions).toHaveProperty('factories.view', true);
  });

  it('does not leak wider roles into an operator session', async () => {
    const profile = iIndustryProfile();
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    mockedAuthRepository.upsertExternalOperatorUser.mockResolvedValue(iIndustryUser());
    mockedAuthRepository.getOperatorProfile.mockResolvedValue({
      user_id: 91,
      user_code: profile.user_code,
      regis_date: profile.regis_date,
    });
    mockedAuthRepository.getOperatorFactories.mockResolvedValue([]);
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['public_user', 'factory_operator'],
      scopes: {
        'dashboard:view': 'ALL',
        'factories:view': 'OWN_FACTORY',
      },
    });
    repositoryBoundary.getRolePermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
        'factories:view': 'OWN_FACTORY',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'operator',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      userType: 'operator',
      roles: 'factory_operator',
      roleCodes: ['factory_operator'],
    });
    expect(response.body.permissions.dashboard).toMatchObject({
      data: 'OWN_FACTORY',
      view: true,
    });
    expect(verifyAccessToken(response.body.accessToken)).toMatchObject({
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: {
        'dashboard:view': 'OWN_FACTORY',
      },
    });
  });

  it.each([
    ['inactive', { ...iIndustryUser(), is_active: false }],
    ['soft-deleted', { ...iIndustryUser(), deleted_at: '2026-08-01T00:00:00.000Z' }],
    ['missing', undefined],
  ])('rejects an %s shared identity before issuing a citizen token', async (_label, user) => {
    const profile = iIndustryProfile();
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer: jest.fn(async () => null),
      authenticateCitizen: jest.fn(async () => null),
      authenticateOperator: jest.fn(async () => profile),
    });
    repositoryBoundary.upsertExternalCitizenUser.mockResolvedValue(user);

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        accountType: 'api',
        userType: 'citizen',
        username: profile.external_id,
        [passwordField]: 'test-credential',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      },
    });
    expect(mockedAuthRepository.updateLastLogin).not.toHaveBeenCalled();
    expect(repositoryBoundary.getRolePermissions).not.toHaveBeenCalled();
  });
});

function iIndustryProfile(): ExternalOperatorProfile {
  return {
    identity_provider: 'i_industry',
    external_id: '1111111111111',
    citizen_id: '1111111111111',
    user_code: 'OP-001',
    first_name: 'ผู้ใช้งาน',
    last_name: 'ทดสอบ',
    email: 'user@example.test',
    phone: '0812345678',
    regis_date: '2026-08-10',
    juristics: [
      {
        juristic_id: '0100000000001',
        name_th: 'บริษัท ทดสอบ จำกัด',
        name_en: 'TEST COMPANY LIMITED',
        factories: [],
      },
    ],
  };
}

function iIndustryUser(): UserRow {
  return {
    id: 91,
    external_id: '1111111111111',
    identity_provider: 'i_industry',
    user_type: 'operator',
    username: '1111111111111',
    email: 'user@example.test',
    phone: '0812345678',
    prename_th: null,
    first_name: 'ผู้ใช้งาน',
    last_name: 'ทดสอบ',
    is_active: true,
    password_hash: null,
  };
}
