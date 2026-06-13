import { Router } from 'express';
import { authenticateIntegrationApiKey } from './integration-api-key.middleware';
import { alertEventsController } from '../alert-events/alert-events.controller';
import { integrationDeviceConfigsController } from './integration-device-configs.controller';

export const integrationsRoutes = Router();

integrationsRoutes.use(authenticateIntegrationApiKey);

integrationsRoutes.get(
  '/device-configs/:stationId',
  integrationDeviceConfigsController.getByStationId,
);
integrationsRoutes.post('/alert-events', alertEventsController.createFromIntegration);
