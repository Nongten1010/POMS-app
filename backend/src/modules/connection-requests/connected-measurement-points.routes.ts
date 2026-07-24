import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { normalizeAnnualPointCodePath } from '../../shared/middlewares/annual-point-code-path';
import { connectionRequestsController } from './connection-requests.controller';

export const connectedMeasurementPointsRoutes = Router();
const stationPath = '/:stationId{/:buddhistYear}';

connectedMeasurementPointsRoutes.use(authenticate);

connectedMeasurementPointsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listConnectedMeasurementPoints,
);
connectedMeasurementPointsRoutes.get(
  '/factories/:factoryId',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listConnectedMeasurementPointDetailsForFactory,
);
connectedMeasurementPointsRoutes.get(
  `${stationPath}/requests`,
  normalizeAnnualPointCodePath,
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listRequestsForConnectedMeasurementPoint,
);
connectedMeasurementPointsRoutes.get(
  `${stationPath}/parameter-form`,
  normalizeAnnualPointCodePath,
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getAddParameterFormDetail,
);
connectedMeasurementPointsRoutes.get(
  `${stationPath}/device-configs`,
  normalizeAnnualPointCodePath,
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getCurrentDeviceConfigFormDetail,
);
connectedMeasurementPointsRoutes.get(
  `${stationPath}/measurement-statistics`,
  normalizeAnnualPointCodePath,
  authorize('dashboard.stats:view'),
  connectionRequestsController.getMeasurementStatistics,
);
connectedMeasurementPointsRoutes.get(
  `${stationPath}/calendar-status`,
  normalizeAnnualPointCodePath,
  authorize('dashboard.stats:view'),
  connectionRequestsController.getCalendarStatus,
);
connectedMeasurementPointsRoutes.post(
  `${stationPath}/device-configs`,
  normalizeAnnualPointCodePath,
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.saveCurrentDeviceConfig,
);
