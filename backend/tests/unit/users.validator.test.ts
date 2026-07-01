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
        regionalAccess: {
          regions: ['ภาคเหนือ'],
        },
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
        regionalAccess: {
          regions: ['ภาคเหนือ'],
        },
      },
      permissionOverrides: expect.arrayContaining([
        { code: 'dashboard:view', effect: 'allow', scope: 'ALL' },
        { code: 'dashboard.search:advanced', effect: 'allow', scope: null },
      ]),
    });
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
        { code: 'dashboard:view', effect: 'allow', scope: 'ALL' },
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
