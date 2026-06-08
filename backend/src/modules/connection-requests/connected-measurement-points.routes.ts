import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { connectionRequestsController } from './connection-requests.controller';

export const connectedMeasurementPointsRoutes = Router();

connectedMeasurementPointsRoutes.use(authenticate);

connectedMeasurementPointsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listConnectedMeasurementPoints,
);
