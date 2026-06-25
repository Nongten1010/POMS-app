import { describe, expect, it } from '@jest/globals';
import { shouldInsertUserJuristicAccess } from '../../src/modules/auth/auth.repository';

describe('authRepository operator juristic sync', () => {
  it('inserts juristic access only when no existing user_juristics row exists', () => {
    expect(shouldInsertUserJuristicAccess(undefined)).toBe(true);
    expect(shouldInsertUserJuristicAccess(null)).toBe(true);
  });

  it('keeps existing juristic access state so revoked rows are not restored on login', () => {
    expect(shouldInsertUserJuristicAccess({ user_id: 4, revoked_at: null })).toBe(false);
    expect(
      shouldInsertUserJuristicAccess({
        user_id: 4,
        revoked_at: '2026-06-25T21:15:53.124+07:00',
      }),
    ).toBe(false);
  });
});
