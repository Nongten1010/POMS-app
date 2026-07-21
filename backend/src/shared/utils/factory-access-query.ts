import type { Knex } from 'knex';
import { db } from '../../config/database';

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
  });
}
