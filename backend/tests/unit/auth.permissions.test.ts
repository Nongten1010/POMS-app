import { describe, expect, it } from '@jest/globals';
import { groupPermissions } from '../../src/modules/auth/permissions';

describe('groupPermissions', () => {
  it('keeps existing permission action keys and adds module data scopes', () => {
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
        'alerts:view': true,
        'search:basic': true,
        'search:advanced': true,
        'stats:view': true,
        'stats:export': true,
      },
      connection: {
        data: 'IN_PROVINCE',
        approve: true,
      },
      helpdesk: {
        data: null,
        submit: true,
      },
      chat: {
        data: null,
        ask: true,
        answer: true,
      },
    });
  });
});
