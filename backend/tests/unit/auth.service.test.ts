import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  env: {
    JWT_EXPIRES_IN: '15m',
    JWT_SECRET: 'test-secret-at-least-16-chars',
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../src/shared/utils/jwt', () => ({
  signAccessToken: jest.fn(() => 'signed-access-token'),
  parseDurationToSeconds: jest.fn(() => 900),
}));

jest.mock('../../src/modules/auth/identity-provider', () => ({
  getIdentityProvider: jest.fn(() => ({
    authenticateOfficer: jest.fn(),
    authenticateOperator: jest.fn(),
    authenticateCitizen: jest.fn(),
  })),
}));

jest.mock('../../src/modules/auth/auth.repository', () => ({
  authRepository: {
    findUserByProviderAndExternalId: jest.fn(),
    findUserByUsername: jest.fn(),
    updateLastLogin: jest.fn(),
    getOfficerProfile: jest.fn(),
    getOperatorProfile: jest.fn(),
    getOperatorFactories: jest.fn(),
    getRolesAndPermissions: jest.fn(),
  },
}));

import { authRepository } from '../../src/modules/auth/auth.repository';
import { authService } from '../../src/modules/auth/auth.service';

const mockedAuthRepository = jest.mocked(authRepository);

describe('authService login completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a generic unauthorized error when an authenticated officer is not provisioned', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue(undefined);

    await expect(
      authService.completeLoginAsOfficer({
        external_id: 'officer-secret-id',
        prename_th: 'นาย',
        first_name: 'ทดสอบ',
        last_name: 'ระบบ',
        email: null,
        phone: null,
        pos_no: '1',
        pertype_id: '1',
        pertype: 'ข้าราชการ',
        position_type_id: '1',
        position_type_th: 'ทั่วไป',
        line_id: '1',
        line_name_th: 'เจ้าหน้าที่',
        level_id: '1',
        level_name_th: 'ปฏิบัติการ',
        organize_id: '1',
        division_id: '1',
        department_id: '1',
        ministry_id: '1',
        province_id: '1',
        per_status: '1',
        per_status_name: 'ปกติ',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
  });

  it('rejects inactive users before issuing a token', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 12,
      external_id: '1102001567054',
      identity_provider: 'mock',
      user_type: 'officer',
      username: 'weekit',
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ทดสอบ',
      last_name: 'ระบบ',
      is_active: false,
      password_hash: null,
    });

    await expect(
      authService.completeLoginAsOfficer({
        external_id: 'officer001',
        prename_th: 'นาย',
        first_name: 'ทดสอบ',
        last_name: 'ระบบ',
        email: null,
        phone: null,
        pos_no: '1',
        pertype_id: '1',
        pertype: 'ข้าราชการ',
        position_type_id: '1',
        position_type_th: 'ทั่วไป',
        line_id: '1',
        line_name_th: 'เจ้าหน้าที่',
        level_id: '1',
        level_name_th: 'ปฏิบัติการ',
        organize_id: '1',
        division_id: '1',
        department_id: '1',
        ministry_id: '1',
        province_id: '1',
        per_status: '1',
        per_status_name: 'ปกติ',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
    expect(mockedAuthRepository.updateLastLogin).not.toHaveBeenCalled();
  });

  it('rejects local login when the username is not a local identity', async () => {
    mockedAuthRepository.findUserByUsername.mockResolvedValue({
      id: 12,
      external_id: '1102001567054',
      identity_provider: 'mock',
      user_type: 'officer',
      username: 'officer001',
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ทดสอบ',
      last_name: 'ระบบ',
      is_active: true,
      password_hash: null,
    });

    await expect(
      authService.loginLocal({
        userType: 'officer',
        provider: 'local',
        username: 'officer001',
        password: 'demo1234',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
  });

  it('returns the documented login contract for an officer', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 12,
      external_id: '1102001567054',
      identity_provider: 'mock',
      user_type: 'officer',
      username: 'weekit',
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ทดสอบ',
      last_name: 'ระบบ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 12,
      pos_no: '1',
      pertype_id: '1',
      pertype: 'ข้าราชการ',
      position_type_id: '1',
      position_type_th: 'ทั่วไป',
      line_id: '1',
      line_name_th: 'เจ้าหน้าที่',
      level_id: '1',
      level_name_th: 'ปฏิบัติการ',
      organize_id: '1',
      division_id: '1',
      department_id: '2',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {
        'dashboard:view': 'ALL',
        'dashboard.alerts:view': 'ALL',
        'dashboard.search:advanced': 'ALL',
        'permissions:manage': 'ALL',
      },
    });

    const result = await authService.completeLoginAsOfficer({
      external_id: '1102001567054',
      prename_th: 'นาย',
      first_name: 'ทดสอบ',
      last_name: 'ระบบ',
      email: null,
      phone: null,
      pos_no: '1',
      pertype_id: '1',
      pertype: 'ข้าราชการ',
      position_type_id: '1',
      position_type_th: 'ทั่วไป',
      line_id: '1',
      line_name_th: 'เจ้าหน้าที่',
      level_id: '1',
      level_name_th: 'ปฏิบัติการ',
      organize_id: '1',
      division_id: '1',
      department_id: '2',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
    });

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      user: {
        username: '1102001567054',
        fullName: 'นายทดสอบ ระบบ',
        department: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'เจ้าหน้าที่',
        levelNameTh: 'ปฏิบัติการ',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'ALL',
          view: true,
          favorite: true,
          advanced_search: true,
        },
        permissions: {
          data: 'ALL',
          view: true,
        },
      },
    });
  });
});
