import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { alertEventsController } from './alert-events.controller';

export const alertEventsRoutes = Router();

alertEventsRoutes.use(authenticate);

alertEventsRoutes.get('/', authorize('notifications:view'), alertEventsController.list);
alertEventsRoutes.get('/:id', authorize('notifications:view'), alertEventsController.getById);
alertEventsRoutes.patch(
  '/:id/status',
  authorize('notifications:edit'),
  alertEventsController.updateStatus,
);
