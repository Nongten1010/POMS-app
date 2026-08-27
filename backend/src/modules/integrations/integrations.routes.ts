import { NextFunction, Request, Response, Router } from 'express';
import {
  authenticateAlertEventApiKey,
  authenticateDeviceConfigApiKey,
  authenticateFactoryDashboardApiKey,
} from './integration-api-key.middleware';
import { normalizeAnnualPointCodePath } from '../../shared/middlewares/annual-point-code-path';
import { alertEventsController } from '../alert-events/alert-events.controller';
import { integrationDeviceConfigsController } from './integration-device-configs.controller';
import { integrationFactoryDashboardController } from './integration-factory-dashboard.controller';

export const integrationsRoutes = Router();
export const factoryLastHourRoutes = Router();

factoryLastHourRoutes.get(
  '/factories/:registrationNo',
  authenticateFactoryDashboardApiKey,
  integrationFactoryDashboardController.getByRegistrationNo,
);

integrationsRoutes.get(
  '/factories/:registrationNo/dashboard',
  authenticateFactoryDashboardApiKey,
  (_req: Request, res: Response, next: NextFunction) => {
    res.set('Deprecation', 'true');
    next();
  },
  integrationFactoryDashboardController.getByRegistrationNo,
);

integrationsRoutes.get(
  '/device-configs/:stationId{/:buddhistYear}',
  normalizeAnnualPointCodePath,
  authenticateDeviceConfigApiKey,
  integrationDeviceConfigsController.getByStationId,
);
integrationsRoutes.post(
  '/alert-events',
  authenticateAlertEventApiKey,
  alertEventsController.createFromIntegration,
);
