import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { deviceConnectionsController } from './device-connections.controller';

export const deviceConnectionsRoutes = Router();

deviceConnectionsRoutes.use(authenticate);

deviceConnectionsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  deviceConnectionsController.list,
);
deviceConnectionsRoutes.get(
  '/:id',
  authorize('cems_wpms_requests:view'),
  deviceConnectionsController.getById,
);
deviceConnectionsRoutes.post(
  '/',
  authorize('cems_wpms_requests:edit'),
  deviceConnectionsController.create,
);
deviceConnectionsRoutes.post(
  '/test-connection',
  authorize('cems_wpms_requests:edit'),
  deviceConnectionsController.testConnection,
);
