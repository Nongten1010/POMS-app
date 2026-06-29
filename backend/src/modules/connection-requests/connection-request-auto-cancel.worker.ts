import { logger } from '../../config/logger';
import { connectionRequestsService } from './connection-requests.service';

const AUTO_CANCEL_INTERVAL_MS = 60_000;

export function startConnectionRequestAutoCancelWorker(): NodeJS.Timeout {
  const run = async (): Promise<void> => {
    try {
      const canceledCount = await connectionRequestsService.autoCancelExpiredWaitingConnections();
      if (canceledCount > 0) {
        logger.info(
          `[connection-requests] Auto-canceled ${canceledCount} expired waiting connection request(s)`,
        );
      }
    } catch (error) {
      logger.warn('[connection-requests] Auto-cancel worker failed', error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), AUTO_CANCEL_INTERVAL_MS);
  interval.unref();
  return interval;
}
