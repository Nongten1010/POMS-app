import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { pingDatabase, closeDatabase } from './config/database';
import { closeFactorySourceDatabase } from './config/factory-source-database';
import { closeParameterSourceDatabase } from './config/parameter-source-database';
import { closeBoilerSourceDatabase } from './config/boiler-source-database';

const REQUEST_TIMEOUT_MS = 300000;

async function bootstrap(): Promise<void> {
  try {
    await pingDatabase();
  } catch {
    logger.warn('[boot] Continuing without DB connection (dev only). Fix DB and restart.');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`[boot] POMS backend listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`[boot] Environment: ${env.NODE_ENV}`);
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS + 60000;
  server.setTimeout(REQUEST_TIMEOUT_MS);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[boot] ${signal} received — shutting down gracefully`);
    server.close(async () => {
      await closeDatabase();
      await closeFactorySourceDatabase();
      await closeBoilerSourceDatabase();
      await closeParameterSourceDatabase();
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('[boot] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('[boot] Unhandled rejection', reason as Error);
  });
  process.on('uncaughtException', (err) => {
    logger.error('[boot] Uncaught exception', err);
    process.exit(1);
  });
}

void bootstrap();
