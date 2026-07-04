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
connectedMeasurementPointsRoutes.get(
  '/:stationId/requests',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listRequestsForConnectedMeasurementPoint,
);
connectedMeasurementPointsRoutes.get(
  '/:stationId/parameter-form',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getAddParameterFormDetail,
);
connectedMeasurementPointsRoutes.get(
  '/:stationId/device-configs',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getCurrentDeviceConfigFormDetail,
);
connectedMeasurementPointsRoutes.get(
  '/:stationId/measurement-statistics',
  authorize('dashboard.stats:view'),
  connectionRequestsController.getMeasurementStatistics,
);
connectedMeasurementPointsRoutes.get(
  '/:stationId/calendar-status',
  authorize('dashboard.stats:view'),
  connectionRequestsController.getCalendarStatus,
);
connectedMeasurementPointsRoutes.get(
  '/:stationId',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getConnectedMeasurementPointDetail,
);
connectedMeasurementPointsRoutes.post(
  '/:stationId/device-configs',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.saveCurrentDeviceConfig,
);
