import { describe, expect, it } from '@jest/globals';
import { loginSchema } from '../../src/modules/auth/auth.validator';

describe('loginSchema', () => {
  it('accepts operator login with username', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'operator_demo',
      password: 'demo1234',
    });

    expect(result.success).toBe(true);
  });

  it('rejects operator login without username', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      password: 'demo1234',
    });

    expect(result.success).toBe(false);
  });
});
