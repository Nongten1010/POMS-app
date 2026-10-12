import { Router, type Request } from 'express';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { authorize, getScopeDetails } from '../../shared/middlewares/authorize';
import { pomsStatusManagementService } from './poms-status-management.service';
import {
  statusManagementInputSchema,
  statusManagementParamsSchema,
} from './poms-status-management.validator';
import type { StatusActor } from './poms-status-management.types';

export const pomsStatusManagementRoutes = Router();
function actor(req: Request, permission: string): StatusActor {
  const user = req.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0)
    throw new UnauthorizedError('Invalid actor');
  return {
    actorUserId: user.id,
    roles: user.roles,
    scope: getScopeDetails(req, permission),
    regionalAccess: user.regionalAccess ?? null,
  };
}
pomsStatusManagementRoutes.get(
  '/:factoryId/status-management',
  authorize('factories:view'),
  async (req, res, next) => {
    try {
      const { factoryId } = statusManagementParamsSchema.parse(req.params);
      const data = await pomsStatusManagementService.get(factoryId, actor(req, 'factories:view'));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
pomsStatusManagementRoutes.patch(
  '/:factoryId/status-management',
  authorize('factories:view'),
  authorize('factories:edit'),
  async (req, res, next) => {
    try {
      const { factoryId } = statusManagementParamsSchema.parse(req.params);
      const input = statusManagementInputSchema.parse(req.body);
      // Validate both read and write scopes, which can be configured independently.
      await pomsStatusManagementService.get(factoryId, actor(req, 'factories:view'));
      const data = await pomsStatusManagementService.update(
        factoryId,
        actor(req, 'factories:edit'),
        input,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
