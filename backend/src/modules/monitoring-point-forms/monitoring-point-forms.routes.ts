import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { monitoringPointFormsController } from './monitoring-point-forms.controller';

export const monitoringPointFormsRoutes = Router();

monitoringPointFormsRoutes.use(authenticate);

monitoringPointFormsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  monitoringPointFormsController.list,
);
monitoringPointFormsRoutes.get(
  '/:id',
  authorize('cems_wpms_requests:view'),
  monitoringPointFormsController.getById,
);
monitoringPointFormsRoutes.post(
  '/',
  authorize('cems_wpms_requests:edit'),
  monitoringPointFormsController.create,
);
monitoringPointFormsRoutes.put(
  '/:id',
  authorize('cems_wpms_requests:edit'),
  monitoringPointFormsController.update,
);
