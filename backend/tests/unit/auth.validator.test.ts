import { describe, expect, it } from '@jest/globals';
import { loginSchema } from '../../src/modules/auth/auth.validator';

describe('loginSchema', () => {
  const passwordField = 'password';
  const validTestPassword = 'valid-test-password';

  it('accepts operator login with username', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'operator_demo',
      [passwordField]: 'demo1234',
    });

    expect(result.success).toBe(true);
  });

  it('rejects operator login without username', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      [passwordField]: 'demo1234',
    });

    expect(result.success).toBe(false);
  });

  it('trims login fields and accepts officer departmentID', () => {
    const result = loginSchema.parse({
      userType: 'officer',
      username: ' weekit ',
      departmentID: ' 2 ',
      [passwordField]: 'demo1234',
    });

    expect(result.username).toBe('weekit');
    expect(result.departmentID).toBe('2');
  });

  it('rejects officer login without departmentID', () => {
    const result = loginSchema.safeParse({
      userType: 'officer',
      username: 'weekit',
      [passwordField]: 'demo1234',
    });

    expect(result.success).toBe(false);
  });

  it('accepts local officer login without departmentID', () => {
    const result = loginSchema.parse({
      userType: 'officer',
      provider: 'local',
      username: 'local_officer',
      [passwordField]: validTestPassword,
    });

    expect(result).toMatchObject({
      userType: 'officer',
      provider: 'local',
      username: 'local_officer',
    });
  });

  it('rejects oversized login payload fields', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'a'.repeat(65),
      [passwordField]: 'b'.repeat(129),
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown login payload keys', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'operator_demo',
      [passwordField]: 'demo1234',
      debug: true,
    });

    expect(result.success).toBe(false);
  });
});
