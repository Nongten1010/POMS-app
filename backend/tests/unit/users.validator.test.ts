import { describe, expect, it } from '@jest/globals';
import {
  createManagedUserSchema,
  listManagedUsersQuerySchema,
  updateManagedUserSchema,
  userIdParamSchema,
} from '../../src/modules/users/users.validator';

describe('managed users validators', () => {
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
      },
    });

    expect(result.success).toBe(true);
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

  it('coerces route id params to positive integers', () => {
    const result = userIdParamSchema.parse({ id: '42' });

    expect(result.id).toBe(42);
  });
});
