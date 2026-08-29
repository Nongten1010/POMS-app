import { describe, expect, it } from '@jest/globals';
import {
  createLocalAccountSchema,
  createManagedUserSchema,
  listManagedUsersQuerySchema,
  updateManagedUserSchema,
  userIdParamSchema,
  replaceUserPermissionsSchema,
} from '../../src/modules/users/users.validator';

describe('managed users validators', () => {
  const passwordField = 'password';
  const validTestPassword = 'valid-test-password';

  it('defaults list queries to fetch all users', () => {
    const result = listManagedUsersQuerySchema.parse({});

    expect(result).toEqual({ status: 'all' });
  });

  it('normalizes pagination when page or perPage is provided', () => {
    const result = listManagedUsersQuerySchema.parse({ page: '2' });

    expect(result).toEqual({ page: 2, perPage: 25, status: 'all' });
  });

  it('rejects oversized page size', () => {
    const result = listManagedUsersQuerySchema.safeParse({ perPage: '500' });

    expect(result.success).toBe(false);
  });

  it('accepts a valid create payload for an officer user', () => {
    const result = createManagedUserSchema.safeParse({
      username: 'officer9001',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      roleCodes: ['admin'],
      profile: {
        departmentId: '3010000',
        lineNameTh: 'นักวิชาการสิ่งแวดล้อม',
        regionalAccess: {
          regions: [' ภาคตะวันออก '],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile?.regionalAccess).toEqual({ regions: ['ภาคตะวันออก'] });
    }
  });

  it('rejects assigning more than one system role to a managed user', () => {
    const result = createManagedUserSchema.safeParse({
      username: 'officer-multi-role',
      firstName: 'ทดสอบ',
      lastName: 'หลายสิทธิ์',
      roleCodes: ['monitoring_5_centers', 'center_director'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects deprecated divisionId profile input', () => {
    const result = createManagedUserSchema.safeParse({
      username: 'officer9002',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      roleCodes: ['admin'],
      profile: { divisionId: '3010001' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a local account payload with combined fullName and no email or phone', () => {
    const result = createLocalAccountSchema.parse({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      [passwordField]: validTestPassword,
      department: 'กรมโรงงานอุตสาหกรรม',
      lineNameTh: 'นักวิทยาศาสตร์',
      levelNameTh: 'ชำนาญการ',
      regionalAccess: {
        regions: ['ภาคใต้'],
      },
      roles: 'diw_central',
      permissionOverrides: [{ code: 'chat:ask', effect: 'allow' }],
    });

    expect(result).toMatchObject({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      userType: 'officer',
      isActive: true,
      roleCodes: ['diw_central'],
      profile: {
        departmentNameTh: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'นักวิทยาศาสตร์',
        levelNameTh: 'ชำนาญการ',
        regionalAccess: { regions: ['ภาคใต้'] },
      },
    });
  });

  it('accepts the nested local-account payload emitted by the permission page', () => {
    const result = createLocalAccountSchema.parse({
      user: {
        fullName: 'เจ้าหน้าที่ กกพ.',
        username: 'erc_officer',
        password: validTestPassword,
        department: '',
        lineNameTh: '',
        levelNameTh: '',
        roleCodes: ['erc_office'],
        userType: 'officer',
        isActive: true,
      },
      permissions: {},
    });

    expect(result).toMatchObject({
      fullName: 'เจ้าหน้าที่ กกพ.',
      username: 'erc_officer',
      roleCodes: ['erc_office'],
      userType: 'officer',
      isActive: true,
      profile: undefined,
      permissionOverrides: [],
    });
  });

  it('accepts current editable permission groups without data fields on binary modules', () => {
    const result = createLocalAccountSchema.parse({
      user: {
        fullName: 'เจ้าหน้าที่ ทดสอบ',
        username: 'local_permission_editor',
        password: validTestPassword,
        roleCodes: ['admin'],
        isActive: true,
      },
      permissions: {
        connection: {
          data: 'ALL',
          region: null,
          province: null,
          view: true,
          edit: false,
          approve: false,
        },
        helpdesk: { view: true },
        chat: { view: true, edit: false },
        permissions: { view: true },
      },
    });

    expect(result.permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cems_wpms_requests:view',
          effect: 'allow',
          scope: 'ALL',
        }),
        expect.objectContaining({ code: 'cems_wpms_requests:edit', effect: 'deny', scope: null }),
        expect.objectContaining({ code: 'helpdesk:submit', effect: 'allow', scope: null }),
        expect.objectContaining({ code: 'chat:answer', effect: 'deny', scope: null }),
        expect.objectContaining({ code: 'permissions:view', effect: 'allow', scope: null }),
      ]),
    );
  });

  it('rejects removed permission-management fields and actions', () => {
    const baseUser = {
      fullName: 'เจ้าหน้าที่ ทดสอบ',
      username: 'local_permission_editor',
      password: validTestPassword,
      roleCodes: ['admin'],
      isActive: true,
    };

    expect(
      createLocalAccountSchema.safeParse({
        user: baseUser,
        permissions: { helpdesk: { data: 'ALL', view: true } },
      }).success,
    ).toBe(false);
    expect(
      createLocalAccountSchema.safeParse({
        user: baseUser,
        permissions: {
          connection: { data: 'ALL', view: true, direct_connect: true },
        },
      }).success,
    ).toBe(false);
    expect(
      createLocalAccountSchema.safeParse({
        user: baseUser,
        permissions: { api_documentation: { view: true } },
      }).success,
    ).toBe(false);
    expect(
      createLocalAccountSchema.safeParse({
        user: baseUser,
        permissions: {
          dashboard: { data: 'IN_ESTATE', estateCode: 'MTP', view: true },
        },
      }).success,
    ).toBe(false);
    expect(
      createLocalAccountSchema.safeParse({
        user: baseUser,
        permissions: {
          dashboard: { data: 'IN_ESTATE', estate: 'MTP', view: true },
        },
      }).success,
    ).toBe(false);
  });

  it('accepts local account location fields from the permission form', () => {
    const result = createLocalAccountSchema.parse({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      [passwordField]: validTestPassword,
      provinceName: 'ระยอง',
      regionName: 'ภาคตะวันออก',
      roles: 'monitoring_5_centers',
    });

    expect(result).toMatchObject({
      profile: {
        provinceName: 'ระยอง',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    });
  });

  it('treats empty optional local account profile fields as omitted', () => {
    const result = createLocalAccountSchema.parse({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      [passwordField]: validTestPassword,
      department: '',
      lineNameTh: ' ',
      levelNameTh: '',
      roles: 'diw_central',
    });

    expect(result).toMatchObject({
      roleCodes: ['diw_central'],
      profile: undefined,
    });
  });

  it('rejects local account payloads with email or phone fields', () => {
    const result = createLocalAccountSchema.safeParse({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      [passwordField]: validTestPassword,
      roles: 'diw_central',
      email: 'nope@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('rejects weak local account passwords', () => {
    const result = createLocalAccountSchema.safeParse({
      fullName: 'สมชาย ทดสอบ',
      username: 'local_officer',
      [passwordField]: 'short',
      roles: 'diw_central',
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one role when creating a user', () => {
    const result = createManagedUserSchema.safeParse({
      username: 'officer9001',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      roleCodes: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty update payloads', () => {
    const result = updateManagedUserSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('accepts edit response-shaped update payloads', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        department: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'นักวิทยาศาสตร์',
        levelNameTh: 'ชำนาญการ',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'ALL',
          view: true,
          favorite: true,
          search: true,
          advanced_search: true,
          statistics: true,
        },
        conditional_search: {
          data: null,
          view: true,
        },
      },
    });

    expect(result).toMatchObject({
      username: 'local_officer',
      externalId: 'local_officer',
      firstName: 'สมชาย ทดสอบ',
      lastName: '',
      password: undefined,
      isActive: true,
      roleCodes: ['diw_central'],
      profile: {
        departmentNameTh: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'นักวิทยาศาสตร์',
        levelNameTh: 'ชำนาญการ',
      },
      permissionOverrides: expect.arrayContaining([
        { code: 'dashboard:view', effect: 'allow', scope: 'ALL' },
        { code: 'dashboard.search:advanced', effect: 'allow', scope: 'ALL' },
        { code: 'conditional_search:view', effect: 'deny', scope: null },
      ]),
    });
  });

  it('does not derive an API external identity from an editable response username', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        identityProvider: 'diw_dpis',
        fullName: 'เจ้าหน้าที่ ทดสอบ',
        username: 'U100',
        password: '',
        department: 'กรมโรงงานอุตสาหกรรม',
        lineNameTh: 'นักวิทยาศาสตร์',
        levelNameTh: 'ชำนาญการ',
        roleCodes: ['diw_central'],
        roles: 'diw_central',
        isActive: true,
        source: 'api',
      },
    });

    expect(result).toMatchObject({
      username: 'U100',
      externalId: undefined,
      roleCodes: ['diw_central'],
      profile: undefined,
    });
  });

  it('keeps authorization-area fields when editing an API-managed officer', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        accountType: 'api',
        source: 'api',
        fullName: 'เจ้าหน้าที่ ศูนย์',
        username: 'U101',
        regionName: 'ภาคตะวันออก',
        roleCodes: ['monitoring_5_centers'],
        isActive: true,
      },
    });

    expect(result).toMatchObject({
      roleCodes: ['monitoring_5_centers'],
      profile: {
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    });
  });

  it('preserves explicit nulls so changing roles clears stale area assignments', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'เจ้าหน้าที่ ส่วนกลาง',
        username: 'central_officer',
        regionName: null,
        provinceName: null,
        estateCode: null,
        roleCodes: ['diw_central'],
        isActive: true,
      },
    });

    expect(result.profile).toEqual({
      departmentNameTh: undefined,
      lineNameTh: undefined,
      levelNameTh: undefined,
      provinceName: null,
      estateCode: null,
      regionalAccess: null,
    });
  });

  it('accepts user-level profile assignment fields from the permission form payload', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        provinceName: 'ระยอง',
        regionName: 'ภาคตะวันออก',
        roles: 'monitoring_5_centers',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'IN_PROVINCE',
          view: true,
        },
      },
    });

    expect(result).toMatchObject({
      roleCodes: ['monitoring_5_centers'],
      profile: {
        provinceName: 'ระยอง',
        regionalAccess: { regions: ['ภาคตะวันออก'] },
      },
    });
  });

  it('accepts edit response-shaped permissions as the only location source', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        roles: 'monitoring_5_centers',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'IN_PROVINCE',
          region: null,
          province: 'ระยอง',
          view: true,
        },
      },
    });

    expect(result).toMatchObject({
      permissionOverrides: expect.arrayContaining([
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: undefined,
          province: 'ระยอง',
        },
      ]),
    });
  });

  it('turns unchecked role actions into explicit deny overrides', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        roles: 'monitoring_5_centers',
        isActive: true,
      },
      permissions: {
        factories: {
          data: 'IN_REGION',
          region: 'ภาคตะวันออก',
          view: true,
          edit: false,
          approve: false,
        },
      },
    });

    expect((result as { permissionOverrides?: unknown }).permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'factories:view', effect: 'allow' }),
        expect.objectContaining({ code: 'factories:edit', effect: 'deny' }),
        expect.objectContaining({ code: 'factories:approve', effect: 'deny' }),
      ]),
    );
  });

  it('accepts one profile estate assignment in an edit response payload', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'เจ้าหน้าที่ กนอ.',
        username: 'ieat_officer',
        password: '',
        roles: 'industrial_estate',
        estateCode: 'MTP',
        isActive: true,
      },
      permissions: {},
    });

    expect(result).toMatchObject({
      roleCodes: ['industrial_estate'],
      profile: { estateCode: 'MTP' },
    });
  });

  it('accepts per-menu region and province scopes from the permission form', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        roles: 'monitoring_5_centers',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'IN_REGION',
          region: 'ภาคตะวันออก',
          province: 'all',
          view: true,
          search: true,
        },
        factories: {
          data: 'IN_PROVINCE',
          region: 'all',
          province: 'ระยอง',
          view: true,
        },
      },
    });

    expect((result as { permissionOverrides?: unknown }).permissionOverrides).toEqual(
      expect.arrayContaining([
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_REGION',
          region: 'ภาคตะวันออก',
          province: null,
        },
        {
          code: 'dashboard.search:basic',
          effect: 'allow',
          scope: 'IN_REGION',
          region: 'ภาคตะวันออก',
          province: null,
        },
        {
          code: 'factories:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: null,
          province: 'ระยอง',
        },
      ]),
    );
  });

  it('keeps dashboard province scope when statistics menu has all-data scope', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'นางนางพัชริดา จันทรมณี',
        username: '1420900141152',
        password: '',
        department: 'สำนักงานปลัดกระทรวงอุตสาหกรรม',
        lineNameTh: 'นักวิชาการอุตสาหกรรม',
        levelNameTh: 'ชำนาญการ',
        roles: 'provincial_office',
        isActive: true,
        source: 'api',
      },
      permissions: {
        dashboard: {
          data: 'IN_PROVINCE',
          region: null,
          province: 'ฉะเชิงเทรา',
          view: true,
          favorite: true,
          search: true,
          advanced_search: true,
          statistics: true,
          export: true,
        },
        statistics: {
          data: 'ALL',
          region: null,
          province: null,
          view: true,
        },
        conditional_search: {
          data: null,
          region: null,
          province: null,
          view: true,
        },
      },
    });

    expect((result as { permissionOverrides?: unknown }).permissionOverrides).toEqual(
      expect.arrayContaining([
        {
          code: 'dashboard.stats:view',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: undefined,
          province: 'ฉะเชิงเทรา',
        },
        {
          code: 'dashboard.search:advanced',
          effect: 'allow',
          scope: 'IN_PROVINCE',
          region: undefined,
          province: 'ฉะเชิงเทรา',
        },
      ]),
    );
  });

  it('normalizes all permission location dropdown values to clear menu scope location', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        roles: 'monitoring_5_centers',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'IN_REGION',
          region: 'all',
          province: 'all',
          view: true,
        },
      },
    });

    expect((result as { permissionOverrides?: unknown }).permissionOverrides).toEqual(
      expect.arrayContaining([
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_REGION',
          region: null,
          province: null,
        },
      ]),
    );
  });

  it('accepts disabled permission actions in edit response-shaped update payloads', () => {
    const result = updateManagedUserSchema.safeParse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        roles: 'diw_central',
        isActive: true,
      },
      permissions: {
        dashboard: {
          data: 'ALL',
          view: true,
          export: false,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts factory-type-88 scope and frontend action aliases in edit payloads', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'เจ้าหน้าที่ กกพ.',
        username: 'erc_officer',
        roleCodes: ['erc_office'],
        isActive: true,
      },
      permissions: {
        chat: {
          view: true,
          edit: true,
        },
        permissions: {
          view: true,
        },
        eligible_factories: {
          data: 'FACTORY_TYPE_88',
          region: null,
          province: null,
          view: true,
          edit: false,
          approve: false,
        },
      },
    });

    expect((result as { permissionOverrides?: unknown }).permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'chat:answer', effect: 'allow', scope: null }),
        expect.objectContaining({ code: 'permissions:view', effect: 'allow', scope: null }),
        expect.objectContaining({
          code: 'eligible_factories:view',
          effect: 'allow',
          scope: 'FACTORY_TYPE_88',
        }),
        expect.objectContaining({
          code: 'eligible_factories:approve',
          effect: 'deny',
          scope: null,
        }),
      ]),
    );
  });

  it('does not update optional edit profile fields when omitted or blank', () => {
    const result = updateManagedUserSchema.parse({
      user: {
        fullName: 'สมชาย ทดสอบ',
        username: 'local_officer',
        password: '',
        department: null,
        roles: 'diw_central',
        isActive: true,
        source: 'created',
      },
    });

    expect(result).toMatchObject({
      username: 'local_officer',
      password: undefined,
      profile: undefined,
    });
  });

  it('coerces route id params to positive integers', () => {
    const result = userIdParamSchema.parse({ id: '42' });

    expect(result.id).toBe(42);
  });

  it('accepts user permission allow and deny overrides', () => {
    const result = replaceUserPermissionsSchema.safeParse({
      permissions: [
        {
          code: 'dashboard:view',
          effect: 'allow',
          scope: 'IN_REGION',
          region: 'ภาคตะวันออก',
        },
        { code: 'factories:edit', effect: 'deny' },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects duplicate user permission override codes', () => {
    const result = replaceUserPermissionsSchema.safeParse({
      permissions: [
        { code: 'dashboard:view', effect: 'allow', scope: 'ALL' },
        { code: 'dashboard:view', effect: 'deny' },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid user permission scopes', () => {
    const result = replaceUserPermissionsSchema.safeParse({
      permissions: [{ code: 'dashboard:view', effect: 'allow', scope: 'EVERYWHERE' }],
    });

    expect(result.success).toBe(false);
  });
});
