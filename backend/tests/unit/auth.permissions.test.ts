import { describe, expect, it } from '@jest/globals';
import {
  groupPermissions,
  isSameOrNarrowerPermissionScope,
  mergePermissionScopesWithOverrides,
  permissionGroupsToScopes,
  permissionGroupsToUserPermissionOverrides,
} from '../../src/modules/auth/permissions';

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
        'statistics:view': 'ALL',
        'statistics:export': 'ALL',
        'conditional_search:view': 'ALL',
        'cems_wpms_requests:approve': 'IN_PROVINCE',
        'helpdesk:submit': null,
        'chat:view': null,
        'chat:ask': null,
        'chat:answer': null,
        'permissions:view': 'ALL',
        'permissions:manage': 'ALL',
        'eligible_factories:view': 'ALL',
        'eligible_factories:edit': null,
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
        export: true,
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
        ask: true,
        edit: true,
        answer: true,
      },
      permissions: {
        data: 'ALL',
        view: true,
        manage: true,
      },
      eligible_factories: {
        data: 'ALL',
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
          export: true,
        },
        conditional_search: {
          data: 'ALL',
          view: true,
        },
        statistics: {
          data: 'ALL',
          view: true,
          export: true,
        },
        chat: {
          data: null,
          view: true,
          ask: true,
          answer: true,
        },
        permissions: {
          data: 'ALL',
          view: true,
          manage: true,
        },
        eligible_factories: {
          data: null,
          view: true,
          edit: true,
        },
      }),
    ).toEqual({
      'dashboard:view': 'ALL',
      'dashboard.alerts:view': null,
      'dashboard.search:basic': 'ALL',
      'dashboard.search:advanced': 'ALL',
      'dashboard.stats:view': 'ALL',
      'dashboard.stats:export': 'ALL',
      'conditional_search:view': 'ALL',
      'statistics:view': 'ALL',
      'statistics:export': 'ALL',
      'chat:view': null,
      'chat:ask': null,
      'chat:answer': null,
      'permissions:view': null,
      'permissions:manage': null,
      'eligible_factories:view': null,
      'eligible_factories:edit': null,
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
      'kwp_forms:view': {
        scope: 'IN_ESTATE',
        region: null,
        province: null,
        estateCode: 'IE01',
        estate: 'IE01',
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
      kwp_forms: {
        data: 'IN_ESTATE',
        region: null,
        province: null,
        estate: 'IE01',
        view: true,
      },
    });

    expect(permissionGroupsToScopes(grouped)).toEqual({
      'dashboard:view': 'IN_REGION',
      'factories:view': 'IN_PROVINCE',
      'kwp_forms:view': 'IN_ESTATE',
    });
  });

  it('does not let secondary alias modules overwrite dashboard location scopes', () => {
    expect(
      permissionGroupsToScopes({
        dashboard: {
          data: 'IN_PROVINCE',
          region: null,
          province: 'ฉะเชิงเทรา',
          view: true,
          advanced_search: true,
          statistics: true,
          export: true,
        },
        statistics: {
          data: 'ALL',
          view: true,
          export: true,
        },
        conditional_search: {
          data: 'ALL',
          view: true,
        },
      }),
    ).toMatchObject({
      'dashboard:view': 'IN_PROVINCE',
      'dashboard.search:advanced': 'IN_PROVINCE',
      'dashboard.stats:view': 'IN_PROVINCE',
      'dashboard.stats:export': 'IN_PROVINCE',
      'statistics:view': 'ALL',
      'statistics:export': 'ALL',
      'conditional_search:view': 'ALL',
    });
  });

  it('keeps dashboard, statistics, and conditional search permissions decoupled', () => {
    expect(
      groupPermissions({
        'dashboard.search:advanced': 'ALL',
        'dashboard.stats:view': 'ALL',
        'dashboard.stats:export': 'ALL',
      }),
    ).toEqual({
      dashboard: {
        data: 'ALL',
        advanced_search: true,
        statistics: true,
        export: true,
      },
    });
  });

  it('preserves explicit chat and eligible edit actions instead of coercing them to manage', () => {
    expect(
      groupPermissions({
        'chat:view': null,
        'chat:ask': null,
        'chat:answer': null,
        'permissions:manage': 'ALL',
        'eligible_factories:edit': null,
      }),
    ).toEqual({
      chat: {
        data: null,
        view: true,
        ask: true,
        edit: true,
        answer: true,
      },
      permissions: {
        data: 'ALL',
        manage: true,
      },
      eligible_factories: {
        data: null,
        edit: true,
      },
    });
  });

  it('uses frontend-compatible aliases for chat edit and eligible approval', () => {
    expect(
      groupPermissions({
        'chat:answer': null,
        'eligible_factories:approve': 'FACTORY_TYPE_88',
      }),
    ).toEqual({
      chat: {
        data: null,
        edit: true,
        answer: true,
      },
      eligible_factories: {
        data: 'FACTORY_TYPE_88',
        approve: true,
      },
    });

    expect(
      permissionGroupsToScopes({
        chat: { data: 'FACTORY_TYPE_88', edit: true },
        eligible_factories: { data: 'FACTORY_TYPE_88', approve: true },
      }),
    ).toEqual({
      'chat:answer': null,
      'eligible_factories:approve': 'FACTORY_TYPE_88',
    });
  });

  it('ignores menu data scopes for binary permissions', () => {
    expect(
      permissionGroupsToUserPermissionOverrides({
        dashboard: { data: 'ALL', favorite: true },
        chat: { data: 'FACTORY_TYPE_88', edit: true },
      }),
    ).toEqual([
      { code: 'dashboard.alerts:view', effect: 'allow', scope: null },
      { code: 'chat:answer', effect: 'allow', scope: null },
    ]);
  });

  it('projects permission administration as ALL/null while keeping its raw permission binary', () => {
    const grouped = groupPermissions({ 'permissions:view': null });

    expect(grouped).toEqual({ permissions: { data: 'ALL', view: true } });
    expect(permissionGroupsToScopes(grouped)).toEqual({ 'permissions:view': null });
  });

  it('treats permissions.data null as deny even when the view checkbox remains checked', () => {
    expect(
      permissionGroupsToUserPermissionOverrides({
        permissions: { data: null, view: true },
      }),
    ).toEqual([{ code: 'permissions:view', effect: 'deny', scope: null }]);
    expect(
      permissionGroupsToUserPermissionOverrides({
        permissions: { data: 'ALL', view: true },
      }),
    ).toEqual([{ code: 'permissions:view', effect: 'allow', scope: null }]);
  });

  it('treats factory type 88 as a category scope that only ALL can narrow to', () => {
    expect(isSameOrNarrowerPermissionScope('FACTORY_TYPE_88', 'ALL')).toBe(true);
    expect(isSameOrNarrowerPermissionScope('FACTORY_TYPE_88', 'FACTORY_TYPE_88')).toBe(true);
    expect(isSameOrNarrowerPermissionScope('IN_REGION', 'FACTORY_TYPE_88')).toBe(false);
    expect(isSameOrNarrowerPermissionScope('FACTORY_TYPE_88', 'IN_REGION')).toBe(false);
  });
});

describe('mergePermissionScopesWithOverrides', () => {
  it('keeps the widest role scope and ignores overrides that would widen or invent permissions', () => {
    expect(
      mergePermissionScopesWithOverrides(
        [
          { code: 'dashboard:view', scope: 'OWN_FACTORY' },
          { code: 'dashboard:view', scope: 'ALL' },
          { code: 'factories:view', scope: 'OWN_FACTORY' },
          { code: 'kwp_forms:view', scope: 'IN_ESTATE' },
        ],
        [
          {
            code: 'dashboard:view',
            effect: 'allow',
            scope: 'IN_PROVINCE',
            region: null,
            province: 'ระยอง',
          },
          {
            code: 'kwp_forms:view',
            effect: 'allow',
            scope: 'IN_ESTATE',
            region: null,
            province: null,
            estate: 'IE01',
          },
          {
            code: 'factories:view',
            effect: 'allow',
            scope: 'ALL',
            region: null,
            province: null,
          },
          {
            code: 'chat:answer',
            effect: 'allow',
            scope: null,
            region: null,
            province: null,
          },
        ],
      ),
    ).toEqual({
      'dashboard:view': {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ระยอง',
      },
      'kwp_forms:view': {
        scope: 'IN_ESTATE',
        region: null,
        province: null,
        estateCode: 'IE01',
        estate: 'IE01',
      },
      'factories:view': 'OWN_FACTORY',
    });
  });

  it('uses a deterministic role-scope lattice regardless of role row order', () => {
    const first = mergePermissionScopesWithOverrides(
      [
        { code: 'dashboard:view', scope: 'IN_PROVINCE' },
        { code: 'dashboard:view', scope: 'IN_REGION' },
      ],
      [],
    );
    const second = mergePermissionScopesWithOverrides(
      [
        { code: 'dashboard:view', scope: 'IN_REGION' },
        { code: 'dashboard:view', scope: 'IN_PROVINCE' },
      ],
      [],
    );

    expect(first).toEqual({ 'dashboard:view': 'IN_REGION' });
    expect(second).toEqual({ 'dashboard:view': 'IN_REGION' });
  });

  it('removes permissions when a deny override targets an existing role grant', () => {
    expect(
      mergePermissionScopesWithOverrides(
        [{ code: 'dashboard:view', scope: 'ALL' }],
        [
          {
            code: 'dashboard:view',
            effect: 'deny',
            scope: null,
            region: null,
            province: null,
          },
        ],
      ),
    ).toEqual({});
  });
});
