import type { Knex } from 'knex';
import { env } from '../../config/env';
import { db } from '../../config/database';

export function factoryAccessReadTable(alias = 'f'): string {
  if (!env.ELIGIBLE_OPERATOR_ACCESS_ENABLED && alias === 'factories') return 'factories';
  return `${env.ELIGIBLE_OPERATOR_ACCESS_ENABLED ? 'factory_access_identities' : 'factories'} as ${alias}`;
}

export function applyEligibleGrantFilter(
  builder: Knex.QueryBuilder,
  actorUserId: number,
  eligibleAlias: string,
): void {
  builder.whereExists(function eligibleGrant() {
    this.select(db.raw('1'))
      .from('user_eligible_factory_access as eag')
      .join(
        'eligible_factory_source_status as eas',
        'eas.eligible_factory_id',
        'eag.eligible_factory_id',
      )
      .whereRaw('eag.eligible_factory_id = ??', [`${eligibleAlias}.id`])
      .where('eag.user_id', actorUserId)
      .where('eag.status', 'active')
      .whereNull('eag.ended_at')
      .where('eas.flag', '0')
      .whereRaw('eas.verified_fid = ??', [`${eligibleAlias}.factory_registration_no_new`])
      .whereRaw('eag.factory_fid = ??', [`${eligibleAlias}.factory_registration_no_new`])
      .whereRaw('eas.last_success_at > DATEADD(second, ?, SYSUTCDATETIME())', [
        -env.FACTORY_STATUS_MAX_AGE_SECONDS,
      ])
      .whereRaw('eas.last_success_at <= SYSUTCDATETIME()')
      .whereNull(`${eligibleAlias}.deleted_at`);
  });
}

type FactoryTableAlias = 'f' | 'factories';

/**
 * Applies OWN_FACTORY access without expanding a direct factory grant to every
 * factory owned by the same juristic person.
 */
export function applyAssignedFactoryAccessFilter(
  builder: Knex.QueryBuilder,
  actorUserId: number,
  factoryAlias: FactoryTableAlias = 'f',
): void {
  builder.where(function assignedFactoryAccess() {
    this.whereExists(function juristicAccess() {
      this.select(db.raw('1'))
        .from('user_juristics as uj')
        .whereRaw(`uj.juristic_id = ${factoryAlias}.juristic_id`)
        .where('uj.user_id', actorUserId)
        .whereNull('uj.revoked_at');
    }).orWhereExists(function directFactoryAccess() {
      this.select(db.raw('1'))
        .from('user_factory_access as ufa')
        .whereRaw(`ufa.factory_id = ${factoryAlias}.id`)
        .where('ufa.user_id', actorUserId)
        .whereNull('ufa.revoked_at');
    });
    if (env.ELIGIBLE_OPERATOR_ACCESS_ENABLED) {
      this.orWhereExists(function eligibleIdentity() {
        this.select(db.raw('1'))
          .from('eligible_factories as aef')
          .where(function identity() {
            this.whereRaw('aef.factory_registration_no_new = ??', [
              `${factoryAlias}.fid`,
            ]).orWhereRaw('aef.source_factory_id = ??', [`${factoryAlias}.fid`]);
          });
        applyEligibleGrantFilter(this, actorUserId, 'aef');
      });
    }
  });
}
