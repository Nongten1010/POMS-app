import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { connectionRequestsController } from './connection-requests.controller';

export const connectionRequestsRoutes = Router();

connectionRequestsRoutes.use(authenticate);

connectionRequestsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.list,
);
connectionRequestsRoutes.get(
  '/:id',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getById,
);
connectionRequestsRoutes.post(
  '/',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.create,
);
connectionRequestsRoutes.put(
  '/:id/form',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.resubmit,
);
connectionRequestsRoutes.post(
  '/:id/review',
  authorize('cems_wpms_requests:approve'),
  connectionRequestsController.review,
);
connectionRequestsRoutes.post(
  '/:id/confirm-connection',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.confirmConnection,
);
connectionRequestsRoutes.post(
  '/:id/verify-connection',
  authorize('cems_wpms_requests:approve'),
  connectionRequestsController.verifyConnection,
);
