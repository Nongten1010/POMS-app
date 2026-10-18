import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';
import type { AuthenticatedUser } from '../../shared/types/express';
import type { PermissionDataScope, PermissionScopeDetails } from '../auth/permissions';
import { resolveAssignedRegions } from '../auth/regional-access';
import type { ChatAccess } from './chat.types';

export function getChatAccess(user: AuthenticatedUser | undefined): ChatAccess {
  if (!user) throw new UnauthorizedError('Authentication required');
  const granted = (permission: string) => Object.hasOwn(user.scopes, permission);
  if (!granted('chat:view')) throw new ForbiddenError('Chat view permission required');
  const scopeFor = (permission: string): PermissionScopeDetails | undefined =>
    granted(permission)
      ? (user.scopeDetails?.[permission] ?? {
          scope: user.scopes[permission] as PermissionDataScope,
        })
      : undefined;
  const validScope = (details: PermissionScopeDetails | undefined): boolean => {
    switch (details?.scope) {
      case 'ALL':
      case 'OWN_FACTORY':
      case 'FACTORY_TYPE_88':
        return true;
      case 'IN_PROVINCE':
        return Boolean(details.province?.trim());
      case 'IN_REGION':
        return resolveAssignedRegions(details.region, user.regionalAccess).length > 0;
      case 'IN_ESTATE':
        return Boolean(details.estateCode?.trim() || details.estate?.trim());
      default:
        return false;
    }
  };
  const factoryScope = scopeFor('chat:view');
  const createScope = scopeFor('chat:ask');
  const answerScope = scopeFor('chat:answer');
  const canAccess =
    ['operator', 'officer', 'admin'].includes(user.userType) &&
    user.roles.length > 0 &&
    validScope(factoryScope);
  return {
    actorUserId: user.id,
    userType: user.userType,
    roles: user.roles,
    factoryScope,
    createScope,
    answerScope,
    regionalAccess: user.regionalAccess ?? null,
    canCreateTicket: canAccess && validScope(createScope),
    canWrite: canAccess && (validScope(createScope) || validScope(answerScope)),
  };
}

export function requireChatWrite(access: ChatAccess, create = false): void {
  if (create ? !access.canCreateTicket : !access.canWrite) {
    throw new ForbiddenError(
      create ? 'Chat ask permission required' : 'Chat write permission required',
    );
  }
}
