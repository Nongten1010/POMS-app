import type { AuthenticatedUser } from '../../shared/types/express';
import { groupPermissions } from '../auth/permissions';
import { pomsFactoriesRepository } from '../poms-factories/poms-factories.repository';
import { connectionRequestsRepository } from '../connection-requests/connection-requests.repository';
import { kwpFormReportsRepository } from '../kwp-form-reports/kwp-form-reports.repository';
import { bodCodDeviationReportsRepository } from '../bod-cod-deviations/bod-cod-deviation-reports.repository';
import { eligibleFactoriesRepository } from '../eligible-factories/eligible-factories.repository';
import { alertEventsRepository } from '../alert-events/alert-events.repository';
import type { MenuBadges } from './menu-badges.types';

const directors = new Set(['kpm_director', 'center_director', 'kwp_director']);
const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const menuBadgesService = {
  async get(user: AuthenticatedUser): Promise<MenuBadges> {
    // Authentication supplies current roles/scopes; never read identity or scope from request input.
    const permissions = groupPermissions(
      Object.fromEntries(
        Object.entries(user.scopes).map(([code, scope]) => [
          code,
          user.scopeDetails?.[code] ?? scope,
        ]),
      ),
    );
    const admin = user.roles.includes('admin');
    const operator = user.userType === 'operator';
    const officer = user.userType === 'officer' || admin;
    const director = !admin && user.roles.some((role) => directors.has(role));
    const canView = (menu: keyof MenuBadges) => permissions[menu]?.view === true;
    const canSeeRequest = (menu: keyof MenuBadges) =>
      canView(menu) && (operator || (officer && permissions[menu]?.approve === true));
    const access = (permission: string) => ({
      actorUserId: user.id,
      scope: user.scopeDetails?.[permission] ?? user.scopes[permission],
      regionalAccess: user.regionalAccess,
    });

    const [factories, connection, kwp_forms, bod_cod_errors, eligible_factories, notifications] =
      await Promise.all([
        canSeeRequest('factories')
          ? pomsFactoriesRepository.hasEditRequestsInStatuses(
              operator ? ['REVISION_REQUESTED'] : ['PENDING_REVIEW', 'REVISED_PENDING_REVIEW'],
              access('factories:view'),
            )
          : false,
        canSeeRequest('connection')
          ? connectionRequestsRepository.hasTableRequestsInStatuses(
              operator
                ? [
                    'WAITING_FACTORY_REVISION',
                    'WAITING_CONNECTION',
                    'WAITING_FACTORY_DEVICE_CONFIG',
                    'WAITING_FACTORY_DEVICE_CONFIGURATION',
                    'WAITING_DEVICE_CONFIG',
                  ]
                : [
                    'PENDING_DESIGN_REVIEW',
                    'REVISED_PENDING_DESIGN_REVIEW',
                    'CONNECTION_CONFIRMED',
                  ],
              access('cems_wpms_requests:view'),
            )
          : false,
        canSeeRequest('kwp_forms')
          ? kwpFormReportsRepository.hasRequestsInStatuses(
              operator ? ['REVISION_REQUESTED'] : ['SUBMITTED', 'UNDER_REVIEW'],
              access('kwp_forms:view'),
            )
          : false,
        canSeeRequest('bod_cod_errors')
          ? bodCodDeviationReportsRepository.hasReportsInStatuses(
              operator
                ? ['REVISION_REQUESTED']
                : director
                  ? ['WAITING_REVIEW', 'WAITING_APPROVAL']
                  : ['SUBMITTED', 'REVISED_PENDING_REVIEW', 'WAITING_RESULT_NOTICE'],
              access('bod_cod_errors:view'),
            )
          : false,
        !operator &&
        canView('eligible_factories') &&
        permissions.eligible_factories?.approve === true
          ? eligibleFactoriesRepository.hasPendingAddRequests(access('eligible_factories:view'))
          : false,
        canView('notifications')
          ? alertEventsRepository.hasMenuBadgeEvents(
              bangkokDate.format(new Date()),
              access('notifications:view'),
            )
          : false,
      ]);

    return { factories, connection, kwp_forms, bod_cod_errors, eligible_factories, notifications };
  },
};
