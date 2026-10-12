import { ForbiddenError } from '../../shared/errors/AppError';
import { pomsStatusManagementRepository } from './poms-status-management.repository';
import { statusManagementDTO } from './poms-status-management.state';
import { statusManagementInputSchema } from './poms-status-management.validator';
import type { StatusActor, StatusManagementInput } from './poms-status-management.types';
function requirePermissionScope(actor: StatusActor) {
  if (actor.scope === undefined || actor.scope === null) {
    throw new ForbiddenError('POMS status management requires the requested factory permission');
  }
}
export const pomsStatusManagementService = {
  async get(factoryId: string, actor: StatusActor) {
    requirePermissionScope(actor);
    const result = await pomsStatusManagementRepository.read(factoryId, actor);
    return statusManagementDTO(result.source, result.snapshot);
  },
  async update(factoryId: string, actor: StatusActor, input: StatusManagementInput) {
    requirePermissionScope(actor);
    const parsed = statusManagementInputSchema.parse(input);
    const result = await pomsStatusManagementRepository.update(factoryId, actor, parsed);
    return statusManagementDTO(result.source, result.snapshot);
  },
};
