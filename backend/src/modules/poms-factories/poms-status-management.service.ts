import { ForbiddenError } from '../../shared/errors/AppError';
import { pomsStatusManagementRepository } from './poms-status-management.repository';
import { statusManagementDTO } from './poms-status-management.state';
import { statusManagementInputSchema } from './poms-status-management.validator';
import type { StatusActor, StatusManagementInput } from './poms-status-management.types';
function requireAdmin(actor: StatusActor) {
  if (!actor.roles.includes('admin'))
    throw new ForbiddenError('Only Admin can manage POMS statuses');
}
export const pomsStatusManagementService = {
  async get(factoryId: string, actor: StatusActor) {
    requireAdmin(actor);
    const result = await pomsStatusManagementRepository.read(factoryId, actor);
    return statusManagementDTO(result.source, result.snapshot);
  },
  async update(factoryId: string, actor: StatusActor, input: StatusManagementInput) {
    requireAdmin(actor);
    const parsed = statusManagementInputSchema.parse(input);
    const result = await pomsStatusManagementRepository.update(factoryId, actor, parsed);
    return statusManagementDTO(result.source, result.snapshot);
  },
};
