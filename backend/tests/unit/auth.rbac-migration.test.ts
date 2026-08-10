import { describe, expect, it } from '@jest/globals';
import { mapGrantRows } from '../../src/db/migrations/0089_expand_auth_rbac_permission_scopes';

describe('auth RBAC migration helpers', () => {
  it('maps only grants whose role and permission still exist in the target catalog', () => {
    expect(
      mapGrantRows(
        [
          { role: 'admin', permission: 'dashboard:view', scope: 'ALL' },
          { role: 'missing_role', permission: 'dashboard:view', scope: 'ALL' },
          { role: 'admin', permission: 'missing_permission', scope: 'ALL' },
        ],
        new Map([['admin', 11]]),
        new Map([['dashboard:view', 22]]),
      ),
    ).toEqual([{ role_id: 11, permission_id: 22, scope: 'ALL' }]);
  });
});
