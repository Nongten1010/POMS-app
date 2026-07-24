import { Router } from 'express';
import {
  authenticateAlertEventApiKey,
  authenticateDeviceConfigApiKey,
} from './integration-api-key.middleware';
import { normalizeAnnualPointCodePath } from '../../shared/middlewares/annual-point-code-path';
import { alertEventsController } from '../alert-events/alert-events.controller';
import { integrationDeviceConfigsController } from './integration-device-configs.controller';

export const integrationsRoutes = Router();

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
