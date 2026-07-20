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

jest.mock('../../src/shared/utils/password', () => ({
  verifyPassword: jest.fn(async (plaintext: string) => plaintext === 'valid-test-password'),
  bufferToHashString: jest.fn((value: Buffer | string | null | undefined) =>
    Buffer.isBuffer(value) ? value.toString('utf8') : (value ?? null),
  ),
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
    findUserById: jest.fn(),
    updateLastLogin: jest.fn(),
    getOfficerProfile: jest.fn(),
    getOperatorProfile: jest.fn(),
    getOperatorFactories: jest.fn(),
    getRolesAndPermissions: jest.fn(),
    upsertExternalOfficerUser: jest.fn(),
    syncExternalOfficerProfile: jest.fn(),
    syncExternalOperatorProfile: jest.fn(),
  },
}));

import { authRepository } from '../../src/modules/auth/auth.repository';
import { authService, getOfficerRoleCode } from '../../src/modules/auth/auth.service';
import { getIdentityProvider } from '../../src/modules/auth/identity-provider';
import { signAccessToken } from '../../src/shared/utils/jwt';

const mockedAuthRepository = jest.mocked(authRepository);
const mockedGetIdentityProvider = jest.mocked(getIdentityProvider);
const mockedSignAccessToken = jest.mocked(signAccessToken);
const passwordField = 'password';
const validTestPassword = 'valid-test-password';

describe('getOfficerRoleCode', () => {
  it('uses V2 department names and preserves provincial code 4019000', () => {
    expect(
      getOfficerRoleCode({
        department_id: '01000',
        department_name_th: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
      }),
    ).toBe('industrial_estate');
    expect(
      getOfficerRoleCode({
        department_id: '4019000',
        department_name_th: 'สำนักงานอุตสาหกรรมจังหวัดสระบุรี',
      }),
    ).toBe('provincial_office');
  });

  it('prefers a recognized V2 department name when a legacy code conflicts', () => {
    expect(
      getOfficerRoleCode({
        department_id: '01000',
        department_name_th: 'กรมโรงงานอุตสาหกรรม',
      }),
    ).toBe('diw_central');
    expect(
      getOfficerRoleCode({
        department_id: '3010000',
        department_name_th: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
      }),
    ).toBe('industrial_estate');
  });
});

describe('authService login completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves an explicit POMS account with a provider-scoped local identity', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 41,
      external_id: 'shared_login',
      identity_provider: 'local',
      user_type: 'citizen',
      username: 'shared_login',
      email: null,
      phone: null,
      prename_th: null,
      first_name: 'ผู้ใช้',
      last_name: 'พอมส์',
      is_active: true,
      password_hash: Buffer.from('hashed-password'),
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['citizen'],
      scopes: {},
    });

    const result = await authService.login({
      accountType: 'poms',
      userType: 'citizen',
      username: 'shared_login',
      [passwordField]: validTestPassword,
    } as never);

    expect(mockedAuthRepository.findUserByProviderAndExternalId).toHaveBeenCalledWith(
      'local',
      'shared_login',
    );
    expect(result.user).toMatchObject({
      accountType: 'poms',
      username: 'shared_login',
      roleCodes: ['citizen'],
    });
  });

  it('never falls back to a local account for an explicit API login', async () => {
    await expect(
      authService.login({
        accountType: 'api',
        userType: 'officer',
        username: 'U100',
        departmentID: '8',
        [passwordField]: validTestPassword,
      } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(mockedAuthRepository.findUserByProviderAndExternalId).not.toHaveBeenCalledWith(
      'local',
      'U100',
    );
  });

  it('falls back to an API account when an accountType-less local password does not match', async () => {
    const externalProfile = {
      identity_provider: 'officer_dpis' as const,
      external_id: 'U100',
      prename_th: 'นาย',
      first_name: 'ผู้ใช้',
      last_name: 'เอพีไอ',
      email: null,
      phone: null,
      pos_no: '100',
      pertype_id: '1',
      pertype: 'ข้าราชการ',
      position_type_id: '1',
      position_type_th: 'ทั่วไป',
      line_id: '1',
      line_name_th: 'เจ้าหน้าที่',
      level_id: '1',
      level_name_th: 'ปฏิบัติการ',
      organize_id: '1',
      department_id: '2',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
    };
    const authenticateOfficer = jest.fn(
      async (_username: string, _password: string, _departmentID: string) => externalProfile,
    );
    mockedGetIdentityProvider.mockReturnValue({
      authenticateOfficer,
      authenticateOperator: jest.fn(async (_username: string, _password: string) => null),
      authenticateCitizen: jest.fn(async (_username: string, _password: string) => null),
    });
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 41,
      external_id: 'U100',
      identity_provider: 'local',
      user_type: 'officer',
      username: 'U100',
      email: null,
      phone: null,
      prename_th: null,
      first_name: 'ผู้ใช้',
      last_name: 'พอมส์',
      is_active: true,
      password_hash: Buffer.from('hashed-password'),
    });
    mockedAuthRepository.upsertExternalOfficerUser.mockResolvedValue({
      id: 52,
      external_id: 'U100',
      identity_provider: 'officer_dpis',
      user_type: 'officer',
      username: 'U100',
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ผู้ใช้',
      last_name: 'เอพีไอ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 52,
      pos_no: '100',
      pertype_id: '1',
      pertype: 'ข้าราชการ',
      position_type_id: '1',
      position_type_th: 'ทั่วไป',
      line_id: '1',
      line_name_th: 'เจ้าหน้าที่',
      level_id: '1',
      level_name_th: 'ปฏิบัติการ',
      organize_id: '1',
      department_id: '2',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {},
    });

    const result = await authService.login({
      userType: 'officer',
      username: 'U100',
      departmentID: '2',
      [passwordField]: 'api-valid-password',
    });

    expect(authenticateOfficer).toHaveBeenCalledWith('U100', 'api-valid-password', '2');
    expect(mockedAuthRepository.updateLastLogin).toHaveBeenCalledWith(52);
    expect(result.user).toMatchObject({
      accountType: 'api',
      username: 'U100',
      roleCodes: ['diw_central'],
    });
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
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
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
        [passwordField]: 'demo1234',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
  });

  it('checks local accounts before requiring officer departmentID', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 44,
      external_id: 'local_officer',
      identity_provider: 'local',
      user_type: 'officer',
      username: 'local_officer',
      email: null,
      phone: null,
      prename_th: null,
      first_name: 'สมชาย ทดสอบ',
      last_name: '',
      is_active: true,
      password_hash: Buffer.from('hashed-password'),
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 44,
      pos_no: null,
      pertype_id: null,
      pertype: null,
      position_type_id: null,
      position_type_th: null,
      line_id: null,
      line_name_th: 'นักวิทยาศาสตร์',
      level_id: null,
      level_name_th: 'ชำนาญการ',
      organize_id: null,
      department_id: null,
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: null,
      province_id: null,
      per_status: null,
      per_status_name: null,
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {
        'dashboard:view': {
          scope: 'IN_REGION',
          region: 'ภาคตะวันออก',
          province: null,
        },
      },
    });

    const result = await authService.login({
      userType: 'officer',
      username: 'local_officer',
      [passwordField]: validTestPassword,
    });

    expect(result.user).toMatchObject({
      userType: 'officer',
      username: 'local_officer',
      fullName: 'สมชาย ทดสอบ',
      prenameTh: null,
      firstName: 'สมชาย ทดสอบ',
      lastName: '',
      department: 'กรมโรงงานอุตสาหกรรม',
      lineNameTh: 'นักวิทยาศาสตร์',
      levelNameTh: 'ชำนาญการ',
      mposition: null,
      organize: null,
      division: null,
      provinceId: null,
      roles: 'diw_central',
      isActive: true,
    });
    expect(result.permissions.dashboard).toEqual({
      data: 'IN_REGION',
      region: 'ภาคตะวันออก',
      province: null,
      view: true,
    });
    expect(mockedSignAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: {
          'dashboard:view': 'IN_REGION',
        },
        scopeDetails: {
          'dashboard:view': {
            scope: 'IN_REGION',
            region: 'ภาคตะวันออก',
            province: null,
          },
        },
      }),
    );
    expect(mockedAuthRepository.updateLastLogin).toHaveBeenCalledWith(44);
    expect(mockedGetIdentityProvider).not.toHaveBeenCalled();
  });

  it('infers central-region access for กวภ officers before issuing a token', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 45,
      external_id: 'local_central_officer',
      identity_provider: 'local',
      user_type: 'officer',
      username: 'local_central_officer',
      email: null,
      phone: null,
      prename_th: 'นางสาว',
      first_name: 'กลาง',
      last_name: 'ทดสอบ',
      is_active: true,
      password_hash: Buffer.from('hashed-password'),
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 45,
      pos_no: null,
      pertype_id: null,
      pertype: null,
      position_type_id: null,
      position_type_th: null,
      line_id: null,
      line_name_th: 'เจ้าหน้าที่ กวภ.',
      level_id: null,
      level_name_th: 'ชำนาญการ',
      organize_id: null,
      department_id: null,
      department_name_th: 'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      ministry_id: null,
      province_id: null,
      per_status: null,
      per_status_name: null,
      regional_access_json: null,
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {
        'bod_cod_errors:view': 'ALL',
        'kwp_forms:view': 'ALL',
      },
    });

    const result = await authService.login({
      userType: 'officer',
      username: 'local_central_officer',
      [passwordField]: validTestPassword,
    });

    expect(result.user).toMatchObject({
      username: 'local_central_officer',
      regionalAccess: { regions: ['ภาคกลาง'] },
    });
    expect(mockedSignAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        regionalAccess: { regions: ['ภาคกลาง'] },
      }),
    );
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
      mposition: 'นักวิชาการ',
      organize_id: '1',
      organize_name_th: 'กลุ่มทดสอบ',
      division_name_th: 'กองทดสอบ',
      department_id: '2',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
      regional_access_json: JSON.stringify({ regions: ['ภาคตะวันออก'] }),
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {
        'dashboard:view': 'ALL',
        'dashboard.alerts:view': 'ALL',
        'dashboard.search:advanced': 'ALL',
        'dashboard.stats:view': 'ALL',
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
      department_id: '2',
      ministry_id: '1',
      province_id: '1',
      per_status: '1',
      per_status_name: 'ปกติ',
    });

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      user: {
        accountType: 'api',
        userType: 'officer',
        username: '1102001567054',
        fullName: 'นายทดสอบ ระบบ',
        name: {
          prenameTh: 'นาย',
          firstName: 'ทดสอบ',
          lastName: 'ระบบ',
          fullName: 'นายทดสอบ ระบบ',
        },
        prenameTh: 'นาย',
        firstName: 'ทดสอบ',
        lastName: 'ระบบ',
        department: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'เจ้าหน้าที่',
        levelNameTh: 'ปฏิบัติการ',
        mposition: 'นักวิชาการ',
        organize: 'กลุ่มทดสอบ',
        division: 'กองทดสอบ',
        provinceId: '1',
        roles: 'diw_central',
        roleCodes: ['diw_central'],
        isActive: true,
        regionalAccess: { regions: ['ภาคตะวันออก'] },
        officerProfile: {
          lineNameTh: 'เจ้าหน้าที่',
          levelNameTh: 'ปฏิบัติการ',
          mposition: 'นักวิชาการ',
          organize: { id: '1', name: 'กลุ่มทดสอบ' },
          division: 'กองทดสอบ',
          department: { id: '2', name: 'กรมโรงงานอุตสาหกรรม' },
        },
      },
      permissions: {
        dashboard: {
          data: 'ALL',
          view: true,
          favorite: true,
          advanced_search: true,
          statistics: true,
        },
        permissions: {
          data: 'ALL',
          view: true,
        },
        statistics: {
          data: 'ALL',
          view: true,
        },
        conditional_search: {
          data: 'ALL',
          view: true,
        },
      },
    });
    expect(mockedSignAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      }),
    );
  });

  it('provisions a DIW DPIS industrial-estate officer before issuing a token', async () => {
    const officerProfile = {
      identity_provider: 'officer_dpis' as const,
      external_id: '1111111111111',
      prename_th: 'นาย',
      first_name: 'ทดสอบกนอ',
      last_name: 'ระบบ',
      email: null,
      phone: null,
      pos_no: '307',
      pertype_id: 'M01',
      pertype: 'พนักงานรายเดือน',
      position_type_id: '14',
      position_type_th: 'วิศวกร',
      line_id: '40000',
      line_name_th: 'สายงานพัฒนาที่ยั่งยืน (สายงาน)',
      level_id: '5',
      level_name_th: '5',
      mposition_id: '14',
      mposition: 'วิศวกร',
      organize_id: '40100',
      organize_name_th: 'ฝ่ายบริการผู้ประกอบกิจการ',
      division_name_th: 'กองอนุญาตผู้ประกอบกิจการ',
      department_id: '01000',
      department_name_th: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ทำงาน',
    };
    mockedAuthRepository.upsertExternalOfficerUser.mockResolvedValue({
      id: 88,
      external_id: officerProfile.external_id,
      identity_provider: 'officer_dpis',
      user_type: 'officer',
      username: officerProfile.external_id,
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ทดสอบกนอ',
      last_name: 'ระบบ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 88,
      pos_no: '2071',
      pertype_id: '99',
      pertype: 'พนักงานจ้างเหมาบริการ',
      position_type_id: '12',
      position_type_th: 'งานสนับสนุน',
      line_id: '',
      line_name_th: 'พนักงานจ้างเหมาบริการ',
      level_id: '',
      level_name_th: 'ลูกจ้างเหมา',
      mposition: 'วิศวกร',
      organize_id: '40100',
      organize_name_th: 'ฝ่ายบริการผู้ประกอบกิจการ',
      division_name_th: 'กองอนุญาตผู้ประกอบกิจการ',
      department_id: '01000',
      department_name_th: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
      ministry_id: '',
      province_id: '',
      per_status: '1',
      per_status_name: 'ทำงาน',
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['industrial_estate'],
      scopes: {
        'dashboard:view': 'IN_ESTATE',
      },
    });

    const result = await authService.completeLoginAsOfficer(officerProfile);

    expect(mockedAuthRepository.upsertExternalOfficerUser).toHaveBeenCalledWith(
      officerProfile,
      'industrial_estate',
    );
    expect(mockedAuthRepository.syncExternalOfficerProfile).not.toHaveBeenCalled();
    expect(result.user).toMatchObject({
      userType: 'officer',
      username: '1111111111111',
      fullName: 'นายทดสอบกนอ ระบบ',
      prenameTh: 'นาย',
      firstName: 'ทดสอบกนอ',
      lastName: 'ระบบ',
      department: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
      mposition: 'วิศวกร',
      organize: 'ฝ่ายบริการผู้ประกอบกิจการ',
      division: 'กองอนุญาตผู้ประกอบกิจการ',
      roles: 'industrial_estate',
      isActive: true,
    });
  });

  it('provisions the second DIW V2 officer variant with display fields', async () => {
    const officerProfile = {
      identity_provider: 'officer_dpis' as const,
      external_id: '2222222222222',
      prename_th: 'นาย',
      first_name: 'ทดสอบกรอ',
      last_name: 'ระบบ',
      email: null,
      phone: null,
      pos_no: '383',
      pertype_id: '5',
      pertype: 'ข้าราชการพลเรือนสามัญ',
      position_type_id: '2',
      position_type_th: 'วิชาการ',
      line_id: '79',
      line_name_th: 'นักวิทยาศาสตร์',
      level_id: '17',
      level_name_th: 'ชำนาญการ',
      mposition_id: '',
      mposition: '',
      organize_id: '3010065',
      organize_name_th: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
      division_name_th: 'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      department_id: '3010000',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
      relocation_type: '1',
      relocation_name: 'มอบหมายงาน',
    };
    mockedAuthRepository.upsertExternalOfficerUser.mockResolvedValue({
      id: 89,
      external_id: officerProfile.external_id,
      identity_provider: 'officer_dpis',
      user_type: 'officer',
      username: 'OFFICER_TEST',
      email: null,
      phone: null,
      prename_th: 'นาย',
      first_name: 'ทดสอบกรอ',
      last_name: 'ระบบ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOfficerProfile.mockResolvedValue({
      user_id: 89,
      pos_no: '383',
      pertype_id: '5',
      pertype: 'ข้าราชการพลเรือนสามัญ',
      position_type_id: '2',
      position_type_th: 'วิชาการ',
      line_id: '79',
      line_name_th: 'นักวิทยาศาสตร์',
      level_id: '17',
      level_name_th: 'ชำนาญการ',
      mposition_id: '',
      mposition: '',
      organize_id: '3010065',
      organize_name_th: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
      division_name_th: 'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      department_id: '3010000',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
    });
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['diw_central'],
      scopes: {
        'dashboard:view': 'ALL',
      },
    });

    const result = await authService.completeLoginAsOfficer(officerProfile);

    expect(mockedAuthRepository.upsertExternalOfficerUser).toHaveBeenCalledWith(
      officerProfile,
      'diw_central',
    );
    expect(result.user).toMatchObject({
      userType: 'officer',
      username: '2222222222222',
      fullName: 'นายทดสอบกรอ ระบบ',
      prenameTh: 'นาย',
      firstName: 'ทดสอบกรอ',
      lastName: 'ระบบ',
      levelNameTh: 'ชำนาญการ',
      mposition: null,
      organize: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
      division: 'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      department: 'กรมโรงงานอุตสาหกรรม',
      roles: 'diw_central',
      isActive: true,
    });
  });

  it('returns owned factory ids for an operator login', async () => {
    mockedAuthRepository.findUserByProviderAndExternalId.mockResolvedValue({
      id: 77,
      external_id: '3191000135709',
      identity_provider: 'mock',
      user_type: 'operator',
      username: 'operator_demo',
      email: 'operator@example.com',
      phone: '0999454594',
      prename_th: null,
      first_name: 'ธนาภรณ์',
      last_name: 'ศรีอวบ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOperatorProfile.mockResolvedValue({
      user_id: 77,
      user_code: '53495',
      regis_date: '2023-06-09 12:01:53',
    });
    mockedAuthRepository.getOperatorFactories.mockResolvedValue([
      operatorFactoryRow('0105556125804', '10190003325500'),
      operatorFactoryRow('0105556125804', '72080000125562'),
      operatorFactoryRow('0105556125804', '10900179425649'),
      operatorFactoryRow('0105556125804', '10900061425657'),
      operatorFactoryRow('0107536001346', '10190000125572'),
      operatorFactoryRow('0107536001346', '10190000225448'),
      operatorFactoryRow('0107536001346', '10190000325446'),
    ]);
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'factories:view': 'OWN_FACTORY',
      },
    });

    const operatorProfile = {
      citizen_id: '3191000135709',
      user_code: '53495',
      first_name: 'ธนาภรณ์',
      last_name: 'ศรีอวบ',
      email: 'operator@example.com',
      phone: '0999454594',
      regis_date: '2023-06-09 12:01:53',
      juristics: [
        {
          juristic_id: '0105556125804',
          name_th: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
          name_en: 'INSEE ECOCYCLE COMPANY LIMITED',
          factories: [
            {
              fid: '10190003325500',
              code: '3-106-33/50สบ',
              name: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
              province_id: '1019',
              system_id: 12,
              verify_status: 1,
              authorize_start: '2024-09-02',
              authorize_end: '2024-09-30',
              juristic_start: '2024-08-05',
              verify_date: '2024-09-13',
            },
          ],
        },
      ],
    };

    const result = await authService.completeLoginAsOperator(operatorProfile);

    expect(mockedAuthRepository.syncExternalOperatorProfile).toHaveBeenCalledWith(
      77,
      operatorProfile,
    );
    expect(result.user).toMatchObject({
      userType: 'operator',
      username: '3191000135709',
      fullName: 'ธนาภรณ์ ศรีอวบ',
      roles: 'factory_operator',
      ownedFactoryIds: [
        '10190003325500',
        '72080000125562',
        '10900179425649',
        '10900061425657',
        '10190000125572',
        '10190000225448',
        '10190000325446',
      ],
    });
  });

  it('returns owned factory ids from /me for an operator', async () => {
    mockedAuthRepository.findUserById.mockResolvedValue({
      id: 77,
      external_id: '3191000135709',
      identity_provider: 'mock',
      user_type: 'operator',
      username: 'operator_demo',
      email: 'operator@example.com',
      phone: '0999454594',
      prename_th: null,
      first_name: 'ธนาภรณ์',
      last_name: 'ศรีอวบ',
      is_active: true,
      password_hash: null,
    });
    mockedAuthRepository.getOperatorProfile.mockResolvedValue({
      user_id: 77,
      user_code: '53495',
      regis_date: '2023-06-09 12:01:53',
    });
    mockedAuthRepository.getOperatorFactories.mockResolvedValue([
      operatorFactoryRow('0105556125804', '10190003325500'),
      operatorFactoryRow('0107536001346', '10190000125572'),
    ]);
    mockedAuthRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['factory_operator'],
      scopes: {
        'factories:view': 'OWN_FACTORY',
      },
    });

    const result = await authService.me(77);

    expect(result.user).toMatchObject({
      userType: 'operator',
      ownedFactoryIds: ['10190003325500', '10190000125572'],
    });
  });
});

function operatorFactoryRow(juristicId: string, fid: string) {
  return {
    juristic_id: juristicId,
    juristic_name_th: `บริษัท ${juristicId}`,
    juristic_name_en: null,
    fid,
    code: `code-${fid}`,
    name: `โรงงาน ${fid}`,
    province_id: '1019',
    system_id: 12,
    verify_status: 1,
    authorize_start: '2024-09-02',
    authorize_end: '2024-09-30',
  };
}
