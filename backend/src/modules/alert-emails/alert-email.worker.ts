import type { ActiveAlertEmailPolicy, AlertEmailPolicy } from './alert-email-policy';
import { isAlertEmailHourlyRoundDue, latestAlertEmailPeriods } from './alert-email-rules';

interface WorkerDependencies {
  prepare(now: Date, policy: ActiveAlertEmailPolicy): Promise<unknown>;
  dispatch(): Promise<{ claimed: boolean }>;
  reportError(code: 'PREPARATION_FAILED' | 'DISPATCH_FAILED'): void;
}

export function createAlertEmailWorker(policy: AlertEmailPolicy, dependencies: WorkerDependencies) {
  let stopped = false;
  let active: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingHourlyRound: Date | null = null;
  const runAt = async (now: Date): Promise<void> => {
    if (!policy.enabled || stopped || active) return;
    active = (async () => {
      try {
        await dependencies.prepare(now, policy);
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
    if (!stopped && pendingHourlyRound) {
      const pending = pendingHourlyRound;
      pendingHourlyRound = null;
      await runAt(pending);
    }
  };
  const runOnce = (): Promise<void> => runAt(new Date());
  const scheduleNextTick = (): void => {
    if (!policy.enabled || stopped) return;
    const now = Date.now();
    const nextMinute = (Math.floor(now / 60_000) + 1) * 60_000;
    timer = setTimeout(() => {
      timer = null;
      if (!policy.enabled || stopped) return;
      scheduleNextTick();
      const current = new Date();
      let scheduledAt = new Date(Math.min(nextMinute, current.getTime()));
      const latestRound = new Date(
        latestAlertEmailPeriods(current, policy.hourlyDelayMinutes).hourly.scheduledAt,
      );
      // Recover an hourly boundary crossed while the event loop or wall clock was delayed.
      if (latestRound > scheduledAt) scheduledAt = latestRound;
      if (active) {
        // Keep one latest round; its lookback picks up eligible events from earlier missed rounds.
        if (isAlertEmailHourlyRoundDue(scheduledAt, policy.hourlyDelayMinutes)) {
          pendingHourlyRound = scheduledAt;
        }
        return;
      }
      void runAt(scheduledAt);
    }, nextMinute - now);
    timer.unref();
  };
  scheduleNextTick();
  return {
    runOnce,
    async stop(): Promise<void> {
      stopped = true;
      pendingHourlyRound = null;
      if (timer) clearTimeout(timer);
      timer = null;
      await active;
    },
  };
}
