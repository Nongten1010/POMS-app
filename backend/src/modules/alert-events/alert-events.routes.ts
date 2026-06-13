import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { alertEventsController } from './alert-events.controller';

export const alertEventsRoutes = Router();

alertEventsRoutes.use(authenticate);

alertEventsRoutes.get('/', authorize('cems_wpms_requests:view'), alertEventsController.list);
alertEventsRoutes.get('/:id', authorize('cems_wpms_requests:view'), alertEventsController.getById);
alertEventsRoutes.patch(
  '/:id/status',
  authorize('cems_wpms_requests:edit'),
  alertEventsController.updateStatus,
);
