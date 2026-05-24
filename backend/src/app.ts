import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './shared/middlewares/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';

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
  // TODO: mount more feature routes when ready
  // app.use(`${env.API_PREFIX}/users`, usersRoutes);
  // app.use(`${env.API_PREFIX}/factories`, factoriesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
