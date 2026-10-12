import { describe, expect, it } from '@jest/globals';
import {
  applyPersonaPermissionOverrides,
  mergePermissionScopesWithOverrides,
  groupPermissions,
  projectEditablePermissionGroups,
} from '../../src/modules/auth/permissions';

const merge = mergePermissionScopesWithOverrides;
const applyPersona = applyPersonaPermissionOverrides;

describe('saved custom permissions', () => {
  it.each([
    'kwp_forms:view',
    'bod_cod_errors:view',
    'dashboard.search:basic',
    'dashboard.stats:export',
  ])('denies nullable data permission %s instead of allowing unfiltered access', (code) => {
    expect(
      merge([{ code, scope: 'ALL' }], [{ code, effect: 'allow', scope: null }], 'custom'),
    ).toEqual({});
  });

  it('denies an undefined data permission scope from malformed saved state', () => {
    expect(
      merge(
        [{ code: 'kwp_forms:view', scope: 'ALL' }],
        [{ code: 'kwp_forms:view', effect: 'allow', scope: undefined } as never],
        'custom',
      ),
    ).toEqual({});
  });

  it.each(['edit', 'approve'])(
    'inherits nullable %s access from the saved view scope and locations',
    (action) => {
      const savedView = { scope: 'IN_PROVINCE' as const, region: 'ภาคตะวันออก', province: 'ระยอง' };
      expect(
        merge(
          [{ code: 'kwp_forms:view', scope: 'ALL' }],
          [
            {
              code: `kwp_forms:${action}`,
              effect: 'allow',
              scope: null,
              province: 'กรุงเทพมหานคร',
            },
            { code: 'kwp_forms:view', effect: 'allow', ...savedView },
          ],
          'custom',
        ),
      ).toEqual({
        [`kwp_forms:${action}`]: savedView,
        'kwp_forms:view': savedView,
      });
    },
  );

  it.each(['edit', 'approve'])(
    'denies nullable %s without a valid saved view rather than using the role',
    (action) => {
      expect(
        merge(
          [
            { code: 'kwp_forms:view', scope: 'ALL' },
            { code: `kwp_forms:${action}`, scope: null },
          ],
          [{ code: `kwp_forms:${action}`, effect: 'allow', scope: null }],
          'custom',
        ),
      ).toEqual({});
    },
  );

  it('denies nullable actions when the final saved view is explicitly denied', () => {
    expect(
      merge(
        [],
        [
          { code: 'kwp_forms:view', effect: 'allow', scope: 'ALL' },
          { code: 'kwp_forms:edit', effect: 'allow', scope: null },
          { code: 'kwp_forms:view', effect: 'deny', scope: null },
        ],
        'custom',
      ),
    ).toEqual({});
  });

  it.each([
    { scope: 'IN_REGION' as const, region: '   ' },
    { scope: 'IN_PROVINCE' as const, province: null },
    { scope: 'IN_ESTATE' as const },
  ])('denies $scope data and inherited actions without a valid saved location', (view) => {
    expect(
      merge(
        [{ code: 'kwp_forms:view', scope: 'ALL' }],
        [
          { code: 'kwp_forms:view', effect: 'allow', ...view },
          { code: 'kwp_forms:approve', effect: 'allow', scope: null },
        ],
        'custom',
      ),
    ).toEqual({});
  });

  it('inherits the saved estate qualifiers for a legacy nullable action', () => {
    const effective = merge(
      [],
      [
        { code: 'bod_cod_errors:view', effect: 'allow', scope: 'IN_ESTATE', estate: 'IE01' },
        { code: 'bod_cod_errors:edit', effect: 'allow', scope: null },
      ],
      'custom',
    );
    expect(effective['bod_cod_errors:edit']).toEqual({
      scope: 'IN_ESTATE',
      estateCode: 'IE01',
      estate: 'IE01',
    });
  });

  it('keeps stored binary permissions nullable', () => {
    expect(
      merge(
        [],
        [
          { code: 'permissions:manage', effect: 'allow', scope: null },
          { code: 'feedback:submit', effect: 'allow', scope: null },
          { code: 'users:edit', effect: 'allow', scope: null },
        ],
        'custom',
      ),
    ).toEqual({
      'permissions:manage': { scope: null },
      'feedback:submit': { scope: null },
      'users:edit': { scope: null },
    });
  });

  it('preserves a saved estate when projecting the editable matrix', () => {
    const editable = projectEditablePermissionGroups(
      groupPermissions({
        'kwp_forms:view': { scope: 'IN_ESTATE', estateCode: 'NEW', estate: 'NEW' },
      }),
    );
    expect(editable.kwp_forms).toMatchObject({ data: 'IN_ESTATE', estateCode: 'NEW', view: true });
  });
  it('grants an action outside the role and widens data access to the saved scope', () => {
    expect(
      merge(
        [{ code: 'dashboard:view', scope: 'OWN_FACTORY' }],
        [
          { code: 'dashboard:view', effect: 'allow', scope: 'ALL' },
          {
            code: 'cems_wpms_requests:approve',
            effect: 'allow',
            scope: 'IN_PROVINCE',
            province: 'ระยอง',
          },
        ],
        'custom',
      ),
    ).toEqual({
      'dashboard:view': { scope: 'ALL' },
      'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'ระยอง' },
    });
  });

  it('does not restore unselected role permissions, including an empty saved set', () => {
    const role = [
      { code: 'dashboard:view', scope: 'ALL' },
      { code: 'permissions:manage', scope: null },
    ] as const;
    expect(merge(role, [], 'custom')).toEqual({});
    expect(
      merge(role, [{ code: 'permissions:view', effect: 'allow', scope: null }], 'custom'),
    ).toEqual({ 'permissions:view': { scope: null } });
  });

  it('honors explicit denies and keeps saved locations after the role changes', () => {
    const overrides = [
      { code: 'dashboard:view', effect: 'allow', scope: 'IN_ESTATE', estateCode: 'IE01' },
      { code: 'factories:view', effect: 'deny', scope: null },
    ] as const;
    const before = merge([{ code: 'factories:view', scope: 'ALL' }], overrides, 'custom');
    const after = merge([{ code: 'dashboard:view', scope: 'ALL' }], overrides, 'custom');
    expect(before).toEqual({
      'dashboard:view': { scope: 'IN_ESTATE', estateCode: 'IE01', estate: 'IE01' },
    });
    expect(after).toEqual(before);
  });

  it('uses the saved set independently of the selected login persona', () => {
    expect(
      applyPersona(
        { 'dashboard:view': 'OWN_FACTORY' },
        [{ code: 'chat:answer', effect: 'allow', scope: null }],
        'custom',
      ),
    ).toEqual({ 'chat:answer': { scope: null } });
  });

  it('retains the restrictive role_default behavior until a custom set is saved', () => {
    expect(
      merge(
        [{ code: 'dashboard:view', scope: 'OWN_FACTORY' }],
        [{ code: 'dashboard:view', effect: 'allow', scope: 'ALL' }],
        'role_default',
      ),
    ).toEqual({ 'dashboard:view': 'OWN_FACTORY' });
  });
});
