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

  it('accepts officer login without departmentID so backend can check local first', () => {
    const result = loginSchema.safeParse({
      userType: 'officer',
      username: 'weekit',
      [passwordField]: 'demo1234',
    });

    expect(result.success).toBe(true);
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

  it('accepts an explicit POMS account without departmentID', () => {
    const result = loginSchema.parse({
      accountType: 'poms',
      userType: 'officer',
      username: 'local_officer',
      [passwordField]: validTestPassword,
    });

    expect(result.accountType).toBe('poms');
  });

  it.each(['U100', '1111111111111'])(
    'accepts an explicit API officer account (%s) with departmentID',
    (username) => {
      const result = loginSchema.parse({
        accountType: 'api',
        userType: 'officer',
        username,
        departmentID: '8',
        [passwordField]: validTestPassword,
      });

      expect(result).toMatchObject({ accountType: 'api', username, departmentID: '8' });
    },
  );

  it('rejects an explicit API officer account without departmentID', () => {
    const result = loginSchema.safeParse({
      accountType: 'api',
      userType: 'officer',
      username: 'U100',
      [passwordField]: validTestPassword,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a conflicting API account and legacy local provider', () => {
    const result = loginSchema.safeParse({
      accountType: 'api',
      provider: 'local',
      userType: 'officer',
      username: 'U100',
      departmentID: '8',
      [passwordField]: validTestPassword,
    });

    expect(result.success).toBe(false);
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
