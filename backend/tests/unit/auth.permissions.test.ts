import { describe, expect, it } from '@jest/globals';
import { groupPermissions, permissionGroupsToScopes } from '../../src/modules/auth/permissions';

describe('groupPermissions', () => {
  it('maps database permission codes to frontend permission keys with data scopes', () => {
    expect(
      groupPermissions({
        'dashboard:view': 'ALL',
        'dashboard.alerts:view': 'ALL',
        'dashboard.search:basic': 'ALL',
        'dashboard.search:advanced': 'ALL',
        'dashboard.stats:view': 'ALL',
        'dashboard.stats:export': 'ALL',
        'cems_wpms_requests:approve': 'IN_PROVINCE',
        'helpdesk:submit': null,
        'chat:ask': null,
        'chat:answer': null,
      }),
    ).toEqual({
      dashboard: {
        data: 'ALL',
        view: true,
        favorite: true,
        search: true,
        advanced_search: true,
        statistics: true,
        export: true,
      },
      connection: {
        data: 'IN_PROVINCE',
        approve: true,
      },
      statistics: {
        data: 'ALL',
        view: true,
      },
      conditional_search: {
        data: 'ALL',
        view: true,
      },
      helpdesk: {
        data: null,
        view: true,
      },
      chat: {
        data: null,
        view: true,
        edit: true,
      },
    });
  });

  it('maps frontend permission groups back to database permission scopes', () => {
    expect(
      permissionGroupsToScopes({
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
        chat: {
          data: null,
          view: true,
          edit: true,
        },
      }),
    ).toEqual({
      'dashboard:view': 'ALL',
      'dashboard.alerts:view': 'ALL',
      'dashboard.search:basic': 'ALL',
      'dashboard.search:advanced': null,
      'dashboard.stats:view': 'ALL',
      'chat:ask': null,
      'chat:answer': null,
    });
  });

  it('preserves per-menu region and province selections when mapping permissions', () => {
    const grouped = groupPermissions({
      'dashboard:view': {
        scope: 'IN_REGION',
        region: 'ภาคตะวันออก',
        province: null,
      },
      'factories:view': {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ระยอง',
      },
    });

    expect(grouped).toMatchObject({
      dashboard: {
        data: 'IN_REGION',
        region: 'ภาคตะวันออก',
        province: null,
        view: true,
      },
      factories: {
        data: 'IN_PROVINCE',
        region: null,
        province: 'ระยอง',
        view: true,
      },
    });

    expect(permissionGroupsToScopes(grouped)).toEqual({
      'dashboard:view': 'IN_REGION',
      'factories:view': 'IN_PROVINCE',
    });
  });
});
