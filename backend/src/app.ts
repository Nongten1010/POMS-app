import express, { Application, Request, Response } from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './shared/middlewares/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { eligibleFactoriesRoutes } from './modules/eligible-factories/eligible-factories.routes';
import { connectedMeasurementPointsRoutes } from './modules/connection-requests/connected-measurement-points.routes';
import {
  connectionRequestsRoutes,
  operatorFactoryDashboardRoutes,
  operatorFactoryRoutes,
  publicFactoryMapPointRoutes,
} from './modules/connection-requests/connection-requests.routes';
import { deviceConnectionsRoutes } from './modules/device-connections/device-connections.routes';
import { parameterValuesRoutes } from './modules/parameter-values/parameter-values.routes';
import { integrationsRoutes } from './modules/integrations/integrations.routes';
import { alertEventsRoutes } from './modules/alert-events/alert-events.routes';
import { emailTestRoutes } from './modules/email-test/email-test.routes';
import { monitoringPointFormsRoutes } from './modules/monitoring-point-forms/monitoring-point-forms.routes';
import { bodCodDeviationReportsRoutes } from './modules/bod-cod-deviations/bod-cod-deviation-reports.routes';
import { kwpFormReportsRoutes } from './modules/kwp-form-reports/kwp-form-reports.routes';
import { kwpFormSubmissionsRoutes } from './modules/kwp-form-submissions/kwp-form-submissions.routes';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    env.UPLOAD_PUBLIC_PATH,
    express.static(path.resolve(env.UPLOAD_DIR), {
      dotfiles: 'deny',
      fallthrough: false,
      index: false,
      maxAge: '1d',
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get(env.API_PREFIX, (_req: Request, res: Response) => {
    res.json({ success: true, message: 'POMS API', version: '0.1.0' });
  });

  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/users`, usersRoutes);
  app.use(`${env.API_PREFIX}/eligible-factories`, eligibleFactoriesRoutes);
  app.use(`${env.API_PREFIX}/connected-measurement-points`, connectedMeasurementPointsRoutes);
  app.use(`${env.API_PREFIX}/public/factory-map-points`, publicFactoryMapPointRoutes);
  app.use(`${env.API_PREFIX}/operator-factory-dashboard`, operatorFactoryDashboardRoutes);
  app.use(`${env.API_PREFIX}/operator-factories`, operatorFactoryRoutes);
  app.use(`${env.API_PREFIX}/cems-wpms-requests`, connectionRequestsRoutes);
  app.use(`${env.API_PREFIX}/device-connections`, deviceConnectionsRoutes);
  app.use(`${env.API_PREFIX}/parameter-values`, parameterValuesRoutes);
  app.use(`${env.API_PREFIX}/monitoring-point-forms`, monitoringPointFormsRoutes);
  app.use(`${env.API_PREFIX}/bod-cod-deviation-reports`, bodCodDeviationReportsRoutes);
  app.use(`${env.API_PREFIX}/kwp-form-reports`, kwpFormReportsRoutes);
  app.use(`${env.API_PREFIX}/kwp-form-submissions`, kwpFormSubmissionsRoutes);
  app.use(`${env.API_PREFIX}/integrations`, integrationsRoutes);
  app.use(`${env.API_PREFIX}/alert-events`, alertEventsRoutes);
  app.use(`${env.API_PREFIX}/email-test`, emailTestRoutes);
  // TODO: mount more feature routes when ready
  // app.use(`${env.API_PREFIX}/factories`, factoriesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
