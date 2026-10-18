import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';
import type { AuthenticatedUser } from '../../shared/types/express';
import type { PermissionDataScope } from '../auth/permissions';
import type { ChatAccess } from './chat.types';

export function getChatAccess(user: AuthenticatedUser | undefined): ChatAccess {
  if (!user) throw new UnauthorizedError('Authentication required');
  const granted = (permission: string) => Object.hasOwn(user.scopes, permission);
  if (!granted('chat:view')) throw new ForbiddenError('Chat view permission required');
  return {
    actorUserId: user.id,
    userType: user.userType,
    roles: user.roles,
    factoryScope: granted('eligible_factories:view')
      ? (user.scopeDetails?.['eligible_factories:view'] ?? {
          scope: user.scopes['eligible_factories:view'] as PermissionDataScope,
        })
      : undefined,
    regionalAccess: user.regionalAccess ?? null,
    // Only operators start tickets; chat:view retains the existing reply/close flow.
    canCreateTicket: user.userType === 'operator',
    canWrite: true,
  };
}

export function requireChatWrite(access: ChatAccess, create = false): void {
  if (create ? !access.canCreateTicket : !access.canWrite) {
    throw new ForbiddenError(
      create ? 'Only authorized operators can open tickets' : 'Chat use permission required',
    );
  }
}
