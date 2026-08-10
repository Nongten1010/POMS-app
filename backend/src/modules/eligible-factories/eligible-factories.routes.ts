import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { eligibleFactoriesController } from './eligible-factories.controller';

export const eligibleFactoriesRoutes = Router();

eligibleFactoriesRoutes.use(authenticate);

eligibleFactoriesRoutes.get(
  '/candidates',
  authorize('eligible_factories:view'),
  eligibleFactoriesController.listCandidates,
);
eligibleFactoriesRoutes.get(
  '/',
  authorize('eligible_factories:view'),
  eligibleFactoriesController.list,
);
eligibleFactoriesRoutes.post(
  '/',
  authorize('eligible_factories:edit'),
  eligibleFactoriesController.create,
);
eligibleFactoriesRoutes.delete(
  '/:id',
  authorize('eligible_factories:edit'),
  eligibleFactoriesController.remove,
);
