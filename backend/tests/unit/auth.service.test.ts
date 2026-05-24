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
      external_id: 'officer001',
      identity_provider: 'mock',
      user_type: 'officer',
      username: 'officer001',
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
});
