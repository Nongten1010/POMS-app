import { describe, expect, it } from '@jest/globals';
import { PERMISSIONS } from '../../src/db/seeds/05_permissions';
import { GRANTS } from '../../src/db/seeds/06_role_permissions';
import { ROLES } from '../../src/db/seeds/04_roles';

const findGrant = (role: string, permission: string) =>
  GRANTS.find((grant) => grant.role === role && grant.permission === permission);

describe('RBAC seed catalog', () => {
  it('defines the canonical standalone permission codes added by the new matrix', () => {
    expect(PERMISSIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'statistics:view', resource: 'statistics', action: 'view' }),
        expect.objectContaining({
          code: 'statistics:export',
          resource: 'statistics',
          action: 'export',
        }),
        expect.objectContaining({
          code: 'conditional_search:view',
          resource: 'conditional_search',
          action: 'view',
        }),
        expect.objectContaining({ code: 'permissions:view', resource: 'permissions', action: 'view' }),
        expect.objectContaining({
          code: 'eligible_factories:view',
          resource: 'eligible_factories',
          action: 'view',
        }),
        expect.objectContaining({
          code: 'eligible_factories:edit',
          resource: 'eligible_factories',
          action: 'edit',
        }),
        expect.objectContaining({ code: 'chat:view', resource: 'chat', action: 'view' }),
        expect.objectContaining({
          code: 'eligible_factories:approve',
          resource: 'eligible_factories',
          action: 'approve',
        }),
      ]),
    );
  });

  it('defines the ERC office as a read-only factory-type-88 role', () => {
    expect(ROLES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'erc_office',
          name_th: 'สำนักงานกำกับกิจการพลังงาน (กกพ.)',
        }),
      ]),
    );

    for (const permission of [
      'dashboard:view',
      'statistics:view',
      'conditional_search:view',
      'factories:view',
      'cems_wpms_requests:view',
      'kwp_forms:view',
      'bod_cod_errors:view',
      'notifications:view',
      'eligible_factories:view',
    ]) {
      expect(findGrant('erc_office', permission)).toEqual(
        expect.objectContaining({ role: 'erc_office', permission, scope: 'FACTORY_TYPE_88' }),
      );
    }

    expect(findGrant('erc_office', 'factories:edit')).toBeUndefined();
    expect(findGrant('erc_office', 'eligible_factories:approve')).toBeUndefined();
    expect(findGrant('admin', 'eligible_factories:approve')).toEqual(
      expect.objectContaining({
        role: 'admin',
        permission: 'eligible_factories:approve',
        scope: 'ALL',
      }),
    );
  });

  it('limits standalone statistics to officers and admin while keeping operator dashboard stats own-scoped', () => {
    expect(findGrant('diw_central', 'statistics:view')).toEqual(
      expect.objectContaining({ role: 'diw_central', permission: 'statistics:view', scope: 'ALL' }),
    );
    expect(findGrant('diw_central', 'statistics:export')).toEqual(
      expect.objectContaining({ role: 'diw_central', permission: 'statistics:export', scope: 'ALL' }),
    );
    expect(findGrant('provincial_office', 'statistics:view')).toEqual(
      expect.objectContaining({
        role: 'provincial_office',
        permission: 'statistics:view',
        scope: 'IN_PROVINCE',
      }),
    );
    expect(findGrant('provincial_office', 'statistics:export')).toEqual(
      expect.objectContaining({
        role: 'provincial_office',
        permission: 'statistics:export',
        scope: 'IN_PROVINCE',
      }),
    );
    expect(findGrant('industrial_estate', 'statistics:view')).toEqual(
      expect.objectContaining({
        role: 'industrial_estate',
        permission: 'statistics:view',
        scope: 'IN_ESTATE',
      }),
    );
    expect(findGrant('industrial_estate', 'statistics:export')).toEqual(
      expect.objectContaining({
        role: 'industrial_estate',
        permission: 'statistics:export',
        scope: 'IN_ESTATE',
      }),
    );
    expect(findGrant('admin', 'statistics:view')).toEqual(
      expect.objectContaining({ role: 'admin', permission: 'statistics:view', scope: 'ALL' }),
    );
    expect(findGrant('admin', 'statistics:export')).toEqual(
      expect.objectContaining({ role: 'admin', permission: 'statistics:export', scope: 'ALL' }),
    );
    for (const role of ['monitoring_kpm', 'monitoring_5_centers', 'center_director', 'kpm_director']) {
      expect(findGrant(role, 'statistics:view')).toEqual(
        expect.objectContaining({ role, permission: 'statistics:view', scope: 'IN_REGION' }),
      );
      expect(findGrant(role, 'statistics:export')).toEqual(
        expect.objectContaining({ role, permission: 'statistics:export', scope: 'IN_REGION' }),
      );
    }
    expect(findGrant('kwp_director', 'statistics:view')).toEqual(
      expect.objectContaining({ role: 'kwp_director', permission: 'statistics:view', scope: 'ALL' }),
    );
    expect(findGrant('kwp_director', 'statistics:export')).toEqual(
      expect.objectContaining({ role: 'kwp_director', permission: 'statistics:export', scope: 'ALL' }),
    );

    expect(findGrant('factory_operator', 'dashboard.stats:view')).toEqual(
      expect.objectContaining({
        role: 'factory_operator',
        permission: 'dashboard.stats:view',
        scope: 'OWN_FACTORY',
      }),
    );
    expect(findGrant('factory_operator', 'dashboard.stats:export')).toEqual(
      expect.objectContaining({
        role: 'factory_operator',
        permission: 'dashboard.stats:export',
        scope: 'OWN_FACTORY',
      }),
    );
    expect(findGrant('factory_operator', 'statistics:view')).toBeUndefined();
    expect(findGrant('factory_operator', 'statistics:export')).toBeUndefined();
  });

  it('keeps regional monitoring and director data actions inside their assigned region instead of ALL', () => {
    for (const permission of [
      'cems_wpms_requests:view',
      'cems_wpms_requests:edit',
      'cems_wpms_requests:approve',
      'kwp_forms:view',
      'kwp_forms:edit',
      'kwp_forms:approve',
      'bod_cod_errors:view',
      'bod_cod_errors:edit',
      'bod_cod_errors:approve',
      'eligible_factories:view',
    ]) {
      expect(findGrant('monitoring_kpm', permission)).toEqual(
        expect.objectContaining({ role: 'monitoring_kpm', permission, scope: 'IN_REGION' }),
      );
    }

    for (const permission of [
      'cems_wpms_requests:view',
      'kwp_forms:view',
      'kwp_forms:edit',
      'kwp_forms:approve',
      'bod_cod_errors:view',
      'bod_cod_errors:edit',
      'bod_cod_errors:approve',
    ]) {
      expect(findGrant('monitoring_5_centers', permission)).toEqual(
        expect.objectContaining({ role: 'monitoring_5_centers', permission, scope: 'IN_REGION' }),
      );
    }

    for (const permission of ['cems_wpms_requests:view', 'kwp_forms:view', 'bod_cod_errors:view']) {
      expect(findGrant('center_director', permission)).toEqual(
        expect.objectContaining({ role: 'center_director', permission, scope: 'IN_REGION' }),
      );
      expect(findGrant('kpm_director', permission)).toEqual(
        expect.objectContaining({ role: 'kpm_director', permission, scope: 'IN_REGION' }),
      );
      expect(findGrant('kwp_director', permission)).toEqual(
        expect.objectContaining({ role: 'kwp_director', permission, scope: 'ALL' }),
      );
    }

    expect(findGrant('monitoring_kpm', 'cems_wpms_requests:direct_connect')).toEqual(
      expect.objectContaining({
        role: 'monitoring_kpm',
        permission: 'cems_wpms_requests:direct_connect',
        scope: 'IN_REGION',
      }),
    );
    expect(findGrant('admin', 'cems_wpms_requests:direct_connect')).toEqual(
      expect.objectContaining({
        role: 'admin',
        permission: 'cems_wpms_requests:direct_connect',
        scope: 'ALL',
      }),
    );
  });

  it('uses the exact eligible factory scopes and edit restrictions', () => {
    expect(findGrant('factory_operator', 'eligible_factories:view')).toEqual(
      expect.objectContaining({
        role: 'factory_operator',
        permission: 'eligible_factories:view',
        scope: 'OWN_FACTORY',
      }),
    );
    expect(findGrant('diw_central', 'eligible_factories:view')).toEqual(
      expect.objectContaining({ role: 'diw_central', permission: 'eligible_factories:view', scope: 'ALL' }),
    );
    expect(findGrant('provincial_office', 'eligible_factories:view')).toEqual(
      expect.objectContaining({
        role: 'provincial_office',
        permission: 'eligible_factories:view',
        scope: 'IN_PROVINCE',
      }),
    );
    expect(findGrant('industrial_estate', 'eligible_factories:view')).toEqual(
      expect.objectContaining({
        role: 'industrial_estate',
        permission: 'eligible_factories:view',
        scope: 'IN_ESTATE',
      }),
    );
    for (const role of ['monitoring_kpm', 'monitoring_5_centers', 'center_director', 'kpm_director']) {
      expect(findGrant(role, 'eligible_factories:view')).toEqual(
        expect.objectContaining({ role, permission: 'eligible_factories:view', scope: 'IN_REGION' }),
      );
    }
    for (const role of ['kwp_director', 'admin']) {
      expect(findGrant(role, 'eligible_factories:view')).toEqual(
        expect.objectContaining({ role, permission: 'eligible_factories:view', scope: 'ALL' }),
      );
    }

    expect(findGrant('admin', 'eligible_factories:edit')).toEqual(
      expect.objectContaining({ role: 'admin', permission: 'eligible_factories:edit', scope: 'ALL' }),
    );
    for (const role of [
      'factory_operator',
      'diw_central',
      'provincial_office',
      'industrial_estate',
      'monitoring_kpm',
      'monitoring_5_centers',
      'center_director',
      'kpm_director',
      'kwp_director',
    ]) {
      expect(findGrant(role, 'eligible_factories:edit')).toBeUndefined();
    }
    expect(findGrant('monitoring_kpm', 'eligible_factories:manage')).toBeUndefined();
    expect(findGrant('admin', 'eligible_factories:manage')).toEqual(
      expect.objectContaining({ role: 'admin', permission: 'eligible_factories:manage', scope: null }),
    );
  });

  it('splits chat between askers and answerers with explicit chat:view and no director/admin ask access', () => {
    for (const role of [
      'public_user',
      'factory_operator',
      'diw_central',
      'provincial_office',
      'industrial_estate',
    ]) {
      expect(findGrant(role, 'chat:view')).toEqual(
        expect.objectContaining({ role, permission: 'chat:view', scope: null }),
      );
      expect(findGrant(role, 'chat:ask')).toEqual(
        expect.objectContaining({ role, permission: 'chat:ask', scope: null }),
      );
      expect(findGrant(role, 'chat:answer')).toBeUndefined();
    }

    for (const role of ['monitoring_kpm', 'monitoring_5_centers', 'admin']) {
      expect(findGrant(role, 'chat:view')).toEqual(
        expect.objectContaining({ role, permission: 'chat:view', scope: null }),
      );
      expect(findGrant(role, 'chat:answer')).toEqual(
        expect.objectContaining({ role, permission: 'chat:answer', scope: null }),
      );
    }

    expect(findGrant('admin', 'chat:ask')).toBeUndefined();
    for (const role of ['center_director', 'kpm_director', 'kwp_director']) {
      expect(findGrant(role, 'chat:view')).toBeUndefined();
      expect(findGrant(role, 'chat:ask')).toBeUndefined();
      expect(findGrant(role, 'chat:answer')).toBeUndefined();
    }
  });

  it('adds workflow approvals for directors and keeps binary permissions null-scoped', () => {
    expect(findGrant('center_director', 'bod_cod_errors:approve')).toEqual(
      expect.objectContaining({
        role: 'center_director',
        permission: 'bod_cod_errors:approve',
        scope: 'IN_REGION',
      }),
    );
    expect(findGrant('kpm_director', 'bod_cod_errors:approve')).toEqual(
      expect.objectContaining({
        role: 'kpm_director',
        permission: 'bod_cod_errors:approve',
        scope: 'IN_REGION',
      }),
    );
    expect(findGrant('kwp_director', 'bod_cod_errors:approve')).toEqual(
      expect.objectContaining({
        role: 'kwp_director',
        permission: 'bod_cod_errors:approve',
        scope: 'ALL',
      }),
    );

    expect(findGrant('public_anonymous', 'feedback:submit')).toEqual(
      expect.objectContaining({
        role: 'public_anonymous',
        permission: 'feedback:submit',
        scope: null,
      }),
    );
    expect(findGrant('admin', 'notifications:view_status')).toEqual(
      expect.objectContaining({
        role: 'admin',
        permission: 'notifications:view_status',
        scope: 'ALL',
      }),
    );
    expect(findGrant('admin', 'permissions:manage')).toEqual(
      expect.objectContaining({ role: 'admin', permission: 'permissions:manage', scope: null }),
    );
  });
});
