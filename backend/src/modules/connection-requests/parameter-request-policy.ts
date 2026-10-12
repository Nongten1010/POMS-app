import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';

export interface ParameterRequestActorContext {
  actorUserId: number;
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  editScope?: string | null | PermissionScopeDetails;
  viewScope?: string | null | PermissionScopeDetails;
  regionalAccess?: RegionalAccessDTO | null;
}

// The reduced form belongs to administrative edit access, independent of role.
export function canOmitParameterRequestSections(
  actor: Pick<ParameterRequestActorContext, 'editScope'> | null,
): boolean {
  if (!actor || actor.editScope === undefined || actor.editScope === null) return false;
  const scope = typeof actor.editScope === 'object' ? actor.editScope.scope : actor.editScope;
  return scope !== null && scope !== '' && scope !== 'OWN_FACTORY';
}
