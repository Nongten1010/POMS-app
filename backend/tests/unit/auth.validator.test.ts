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

  it('trims login fields and accepts officer departmentID', () => {
    const result = loginSchema.parse({
      userType: 'officer',
      username: ' weekit ',
      departmentID: ' 2 ',
      password: 'demo1234',
    });

    expect(result.username).toBe('weekit');
    expect(result.departmentID).toBe('2');
  });

  it('rejects officer login without departmentID', () => {
    const result = loginSchema.safeParse({
      userType: 'officer',
      username: 'weekit',
      password: 'demo1234',
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized login payload fields', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'a'.repeat(65),
      password: 'b'.repeat(129),
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown login payload keys', () => {
    const result = loginSchema.safeParse({
      userType: 'operator',
      username: 'operator_demo',
      password: 'demo1234',
      debug: true,
    });

    expect(result.success).toBe(false);
  });
});
