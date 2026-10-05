import type { ActiveAlertEmailPolicy, AlertEmailPolicy } from './alert-email-policy';

interface WorkerDependencies {
  prepare(now: Date, policy: ActiveAlertEmailPolicy): Promise<unknown>;
  dispatch(): Promise<{ claimed: boolean }>;
  reportError(code: 'PREPARATION_FAILED' | 'DISPATCH_FAILED'): void;
}

export function createAlertEmailWorker(policy: AlertEmailPolicy, dependencies: WorkerDependencies) {
  let stopped = false;
  let active: Promise<void> | null = null;
  const runOnce = async (): Promise<void> => {
    if (!policy.enabled || stopped || active) return;
    active = (async () => {
      try {
        await dependencies.prepare(new Date(), policy);
      } catch {
        dependencies.reportError('PREPARATION_FAILED');
      }
      // Bound each tick. A slow preparation or SMTP request cannot overlap another tick.
      for (let count = 0; count < 20 && !stopped; count += 1) {
        try {
          if (!(await dependencies.dispatch()).claimed) break;
        } catch {
          dependencies.reportError('DISPATCH_FAILED');
          break;
        }
      }
    })();
    try {
      await active;
    } finally {
      active = null;
    }
  };
  const timer = policy.enabled ? setInterval(() => void runOnce(), 60_000) : null;
  timer?.unref();
  return {
    runOnce,
    async stop(): Promise<void> {
      stopped = true;
      if (timer) clearInterval(timer);
      await active;
    },
  };
}
