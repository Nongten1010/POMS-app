import { Router } from 'express';
import { authenticateIntegrationApiKey } from './integration-api-key.middleware';
import { integrationDeviceConfigsController } from './integration-device-configs.controller';

export const integrationsRoutes = Router();

integrationsRoutes.use(authenticateIntegrationApiKey);

integrationsRoutes.get(
  '/device-configs/:stationId',
  integrationDeviceConfigsController.getByStationId,
);
