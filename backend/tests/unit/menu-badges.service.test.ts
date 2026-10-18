import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedUser } from '../../src/shared/types/express';
import { menuBadgesService } from '../../src/modules/menu-badges/menu-badges.service';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { kwpFormReportsRepository } from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';
import { bodCodDeviationReportsRepository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { alertEventsRepository } from '../../src/modules/alert-events/alert-events.repository';
import { chatRepository } from '../../src/modules/chat/chat.repository';
import {
  flattenPermissionScopes,
  groupPermissions,
  permissionGroupsToPermissionOverrides,
} from '../../src/modules/auth/permissions';

jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: { hasEditRequestsInStatuses: jest.fn() },
}));
jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: { hasTableRequestsInStatuses: jest.fn() },
}));
jest.mock('../../src/modules/kwp-form-reports/kwp-form-reports.repository', () => ({
  kwpFormReportsRepository: { hasRequestsInStatuses: jest.fn() },
}));
jest.mock('../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository', () => ({
  bodCodDeviationReportsRepository: { hasReportsInStatuses: jest.fn() },
}));
jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: { hasPendingAddRequests: jest.fn() },
}));
jest.mock('../../src/modules/alert-events/alert-events.repository', () => ({
  alertEventsRepository: { hasMenuBadgeEvents: jest.fn() },
}));
jest.mock('../../src/modules/chat/chat.repository', () => ({
  chatRepository: { hasOpenTicketsAwaitingReply: jest.fn() },
}));

const checks = {
  factories: jest.mocked(pomsFactoriesRepository.hasEditRequestsInStatuses),
  connection: jest.mocked(connectionRequestsRepository.hasTableRequestsInStatuses),
  kwp_forms: jest.mocked(kwpFormReportsRepository.hasRequestsInStatuses),
  bod_cod_errors: jest.mocked(bodCodDeviationReportsRepository.hasReportsInStatuses),
  eligible_factories: jest.mocked(eligibleFactoriesRepository.hasPendingAddRequests),
  notifications: jest.mocked(alertEventsRepository.hasMenuBadgeEvents),
  chat: jest.mocked(chatRepository.hasOpenTicketsAwaitingReply),
};
const requestMenus = [
  'factories',
  'connection',
  'kwp_forms',
  'bod_cod_errors',
  'eligible_factories',
] as const;
const permissionPrefix = (menu: string) => (menu === 'connection' ? 'cems_wpms_requests' : menu);
function actor(
  userType: AuthenticatedUser['userType'] = 'officer',
  roles = ['diw_central'],
): AuthenticatedUser {
  return {
    id: 42,
    userType,
    roles,
    scopes: Object.fromEntries(
      [...requestMenus, 'notifications', 'chat'].flatMap((menu) => [
        [`${permissionPrefix(menu)}:view`, 'ALL'],
        [`${permissionPrefix(menu)}:approve`, null],
      ]),
    ),
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  Object.values(checks).forEach((check) => check.mockResolvedValue(true));
  jest.useFakeTimers().setSystemTime(new Date('2026-10-15T03:00:00Z'));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('menu badge rules', () => {
  it('returns all seven keys and reflects both true and false existence results', async () => {
    checks.connection.mockResolvedValue(false);
    checks.bod_cod_errors.mockResolvedValue(false);
    expect(await menuBadgesService.get(actor())).toEqual({
      factories: true,
      connection: false,
      kwp_forms: true,
      bod_cod_errors: false,
      eligible_factories: true,
      notifications: true,
      chat: true,
    });
  });

  it.each(requestMenus)('denies %s without view even when approve exists', async (menu) => {
    const user = actor();
    delete user.scopes[`${permissionPrefix(menu)}:view`];
    expect((await menuBadgesService.get(user))[menu]).toBe(false);
    expect(checks[menu]).not.toHaveBeenCalled();
  });

  it.each(
    requestMenus.flatMap((menu) =>
      ['officer', 'admin', 'director'].flatMap((role) => [
        [menu, role, 'missing'],
        [menu, role, 'edit-only'],
        [menu, role, 'false'],
      ]),
    ),
  )('requires own-menu approve for %s / %s / %s', async (rawMenu, role, mode) => {
    const menu = rawMenu as (typeof requestMenus)[number];
    const user = actor('officer', [
      role === 'admin' ? 'admin' : role === 'director' ? 'kpm_director' : 'diw_central',
    ]);
    delete user.scopes[`${permissionPrefix(menu)}:approve`];
    if (mode === 'edit-only') user.scopes[`${permissionPrefix(menu)}:edit`] = 'ALL';
    if (mode === 'false') {
      const groups = groupPermissions(user.scopes);
      groups[menu].approve = false;
      user.scopeDetails = permissionGroupsToPermissionOverrides(groups);
      user.scopes = flattenPermissionScopes(user.scopeDetails);
    }
    expect((await menuBadgesService.get(user))[menu]).toBe(false);
    expect(checks[menu]).not.toHaveBeenCalled();
  });

  it('uses operator statuses without requiring approve and never shows eligible add requests', async () => {
    const user = actor('operator', ['factory_operator']);
    user.scopes = Object.fromEntries(
      Object.keys(user.scopes)
        .filter((code) => code.endsWith(':view'))
        .map((code) => [code, 'OWN_FACTORY']),
    );
    const result = await menuBadgesService.get(user);
    expect(result).toEqual({
      factories: true,
      connection: true,
      kwp_forms: true,
      bod_cod_errors: true,
      eligible_factories: false,
      notifications: true,
      chat: true,
    });
    expect(checks.factories).toHaveBeenCalledWith(
      ['REVISION_REQUESTED'],
      expect.objectContaining({ actorUserId: 42, scope: 'OWN_FACTORY' }),
    );
    expect(checks.connection).toHaveBeenCalledWith(
      [
        'WAITING_FACTORY_REVISION',
        'WAITING_CONNECTION',
        'WAITING_FACTORY_DEVICE_CONFIG',
        'WAITING_FACTORY_DEVICE_CONFIGURATION',
        'WAITING_DEVICE_CONFIG',
      ],
      expect.anything(),
    );
    expect(checks.kwp_forms).toHaveBeenCalledWith(['REVISION_REQUESTED'], expect.anything());
    expect(checks.bod_cod_errors).toHaveBeenCalledWith(['REVISION_REQUESTED'], expect.anything());
    expect(checks.eligible_factories).not.toHaveBeenCalled();
  });

  it('uses the exact officer statuses with no creator or current-step filters', async () => {
    await menuBadgesService.get(actor());
    expect(checks.factories).toHaveBeenCalledWith(
      ['PENDING_REVIEW', 'REVISED_PENDING_REVIEW'],
      expect.anything(),
    );
    expect(checks.connection).toHaveBeenCalledWith(
      ['PENDING_DESIGN_REVIEW', 'REVISED_PENDING_DESIGN_REVIEW', 'CONNECTION_CONFIRMED'],
      expect.anything(),
    );
    expect(checks.kwp_forms).toHaveBeenCalledWith(['SUBMITTED', 'UNDER_REVIEW'], expect.anything());
    expect(checks.bod_cod_errors).toHaveBeenCalledWith(
      ['SUBMITTED', 'REVISED_PENDING_REVIEW', 'WAITING_RESULT_NOTICE'],
      expect.anything(),
    );
  });

  it.each(['kpm_director', 'center_director', 'kwp_director'])(
    'counts both Director statuses for %s in any role position',
    async (role) => {
      await menuBadgesService.get(actor('officer', ['diw_central', role]));
      expect(checks.bod_cod_errors).toHaveBeenCalledWith(
        ['WAITING_REVIEW', 'WAITING_APPROVAL'],
        expect.anything(),
      );
      expect(checks.kwp_forms).toHaveBeenCalledWith(
        ['SUBMITTED', 'UNDER_REVIEW'],
        expect.anything(),
      );
    },
  );

  it.each([
    ['admin', 'kpm_director'],
    ['center_director', 'admin'],
  ])('gives admin precedence over Director (%j)', async (...roles) => {
    await menuBadgesService.get(actor('officer', roles));
    expect(checks.bod_cod_errors).toHaveBeenCalledWith(
      ['SUBMITTED', 'REVISED_PENDING_REVIEW', 'WAITING_RESULT_NOTICE'],
      expect.anything(),
    );
  });

  it('limits other user groups to notifications and the explicitly non-operator eligible menu', async () => {
    const result = await menuBadgesService.get(actor('citizen', []));
    requestMenus
      .filter((menu) => menu !== 'eligible_factories')
      .forEach((menu) => {
        expect(result[menu]).toBe(false);
        expect(checks[menu]).not.toHaveBeenCalled();
      });
    expect(result.eligible_factories).toBe(true);
    expect(result.notifications).toBe(true);
    expect(result.chat).toBe(false);
    expect(checks.chat).not.toHaveBeenCalled();
  });

  it.each(['operator', 'officer', 'admin'] as const)(
    'requires only chat view for %s and passes current Chat access',
    async (userType) => {
      const user = actor(userType, [userType === 'admin' ? 'admin' : 'custom-role']);
      user.scopes = { 'chat:view': 'IN_PROVINCE' };
      user.scopeDetails = { 'chat:view': { scope: 'IN_PROVINCE', province: 'ระยอง' } };
      expect((await menuBadgesService.get(user)).chat).toBe(true);
      expect(checks.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: user.id,
          userType,
          roles: user.roles,
          factoryScope: user.scopeDetails['chat:view'],
          canWrite: false,
        }),
      );
      delete user.scopes['chat:view'];
      checks.chat.mockClear();
      expect((await menuBadgesService.get(user)).chat).toBe(false);
      expect(checks.chat).not.toHaveBeenCalled();
    },
  );

  it('refreshes the Chat badge after replies and propagates query errors', async () => {
    checks.chat.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await menuBadgesService.get(actor())).chat).toBe(true);
    expect((await menuBadgesService.get(actor())).chat).toBe(false);
    checks.chat.mockRejectedValue(new Error('chat database unavailable'));
    await expect(menuBadgesService.get(actor())).rejects.toThrow('chat database unavailable');
  });

  it('does not require approve for notifications and denies absent notification view', async () => {
    const user = actor();
    user.scopes = { 'notifications:view': 'ALL' };
    expect((await menuBadgesService.get(user)).notifications).toBe(true);
    delete user.scopes['notifications:view'];
    checks.notifications.mockClear();
    expect((await menuBadgesService.get(user)).notifications).toBe(false);
    expect(checks.notifications).not.toHaveBeenCalled();
  });

  it('passes each effective menu scope and current assignments independently', async () => {
    const user = actor();
    user.scopes['factories:view'] = 'IN_PROVINCE';
    user.scopeDetails = {
      'factories:view': { scope: 'IN_PROVINCE', province: 'ระยอง' },
      'cems_wpms_requests:view': { scope: 'IN_ESTATE', estateCode: 'MTP' },
    };
    user.regionalAccess = { regions: ['ภาคกลาง'] };
    await menuBadgesService.get(user);
    expect(checks.factories).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: 42,
        scope: user.scopeDetails['factories:view'],
        regionalAccess: user.regionalAccess,
      }),
    );
    expect(checks.connection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: user.scopeDetails['cems_wpms_requests:view'] }),
    );
    expect(checks.kwp_forms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'ALL' }),
    );
  });

  it('handles accounts with the same role and different permissions without sharing results', async () => {
    const first = actor();
    const second = actor();
    second.id = 43;
    second.scopes = {};
    expect((await menuBadgesService.get(first)).factories).toBe(true);
    expect((await menuBadgesService.get(second)).factories).toBe(false);
  });

  it('does not cache old work after the last matching item changes status', async () => {
    checks.factories.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await menuBadgesService.get(actor())).factories).toBe(true);
    expect((await menuBadgesService.get(actor())).factories).toBe(false);
  });

  it('switches notification eventDate exactly at midnight Bangkok without caching yesterday', async () => {
    jest.setSystemTime(new Date('2026-10-14T16:59:59Z'));
    await menuBadgesService.get(actor());
    expect(checks.notifications).toHaveBeenLastCalledWith('2026-10-14', expect.anything());
    jest.setSystemTime(new Date('2026-10-14T17:00:00Z'));
    await menuBadgesService.get(actor());
    expect(checks.notifications).toHaveBeenLastCalledWith('2026-10-15', expect.anything());
  });

  it('propagates a repository error instead of replacing it with false', async () => {
    checks.connection.mockRejectedValue(new Error('database unavailable'));
    await expect(menuBadgesService.get(actor())).rejects.toThrow('database unavailable');
  });
});
