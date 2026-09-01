import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { pomsFactoriesController } from './poms-factories.controller';

export const pomsFactoriesRoutes = Router();

pomsFactoriesRoutes.use(authenticate);

pomsFactoriesRoutes.get('/', authorize('factories:view'), pomsFactoriesController.listFactories);
pomsFactoriesRoutes.get(
  '/edit-requests',
  authorize('factories:view'),
  pomsFactoriesController.listEditRequests,
);
pomsFactoriesRoutes.get(
  '/edit-requests/:id',
  authorize('factories:view'),
  pomsFactoriesController.getEditRequest,
);
pomsFactoriesRoutes.get(
  '/edit-requests/:id/form',
  authorize('factories:view'),
  pomsFactoriesController.getEditRequestForm,
);
pomsFactoriesRoutes.put(
  '/edit-requests/:id/resubmission',
  authorize('factories:view'),
  authorize('factories:edit'),
  pomsFactoriesController.resubmitEditRequest,
);
pomsFactoriesRoutes.post(
  '/edit-requests/:id/review',
  authorize('factories:view'),
  authorize('factories:approve'),
  pomsFactoriesController.reviewEditRequest,
);
pomsFactoriesRoutes.get(
  '/:factoryId/form',
  authorize('factories:view'),
  pomsFactoriesController.getFactoryForm,
);
pomsFactoriesRoutes.get(
  '/:factoryId',
  authorize('factories:view'),
  pomsFactoriesController.getFactoryDetail,
);
pomsFactoriesRoutes.post(
  '/:factoryId/edit-requests',
  authorize('factories:view'),
  authorize('factories:edit'),
  pomsFactoriesController.createEditRequest,
);
