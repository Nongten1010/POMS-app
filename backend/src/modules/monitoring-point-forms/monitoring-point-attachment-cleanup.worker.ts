import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { createMonitoringPointFormAttachmentStorage } from './monitoring-point-form-attachments.service';

export const MONITORING_POINT_ATTACHMENT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

interface MonitoringPointAttachmentCleanupWorkerOptions {
  cleanup?: () => Promise<number>;
  intervalMs?: number;
}

export async function cleanupMonitoringPointAttachments(): Promise<number> {
  return createMonitoringPointFormAttachmentStorage({
    uploadDir: env.UPLOAD_DIR,
    signingSecret: env.JWT_SECRET,
    apiPrefix: env.API_PREFIX,
  }).cleanupExpiredAndOrphaned();
}

export function startMonitoringPointAttachmentCleanupWorker(
  options: MonitoringPointAttachmentCleanupWorkerOptions = {},
): NodeJS.Timeout {
  const cleanup = options.cleanup ?? cleanupMonitoringPointAttachments;
  const intervalMs = options.intervalMs ?? MONITORING_POINT_ATTACHMENT_CLEANUP_INTERVAL_MS;
  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const removedCount = await cleanup();
      if (removedCount > 0) {
        logger.info(
          `[monitoring-point-attachments] Removed ${removedCount} expired or orphaned attachment(s)`,
        );
      }
    } catch (error) {
      logger.warn('[monitoring-point-attachments] Cleanup worker failed', error as Error);
    } finally {
      running = false;
    }
  };

  void run();
  const interval = setInterval(() => void run(), intervalMs);
  interval.unref();
  return interval;
}
