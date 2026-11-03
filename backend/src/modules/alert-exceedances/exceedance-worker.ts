import type { ActiveExceedancePolicy, ExceedancePolicy } from './exceedance-policy';
import { evaluateExceedanceHour, HOUR_MS, type ExceedanceEvaluation } from './exceedance-detector';
import type { ExceedanceSnapshot } from './exceedance-metadata';
import type { ExceedanceCommit, ExceedanceLease, ExceedanceState } from './exceedance-repository';

export interface ExceedanceWorkerDependencies {
  acquire(): Promise<ExceedanceLease | null>;
  renew(lease: ExceedanceLease): Promise<boolean>;
  release(lease: ExceedanceLease, scanAfter: number): Promise<void>;
  listPoints(
    after: number,
  ): Promise<{ points: ExceedanceSnapshot[]; lastId: number; invalid: number }>;
  state(lease: ExceedanceLease, point: ExceedanceSnapshot, now: Date): Promise<ExceedanceState>;
  retryHour(point: ExceedanceSnapshot, now: Date): Promise<Date | null>;
  readRows(point: ExceedanceSnapshot, hour: Date): Promise<Record<string, unknown>[]>;
  commit(
    lease: ExceedanceLease,
    point: ExceedanceSnapshot,
    hour: Date,
    evaluation: ExceedanceEvaluation,
    now: Date,
  ): Promise<ExceedanceCommit>;
  cleanup(now: Date): Promise<void>;
  report(summary: Record<string, number | string>): void;
  now?(): Date;
}

/** Lightweight due checks may tick each minute; completed hourly jobs are not reread each tick. */
export function createExceedanceWorker(
  policy: ExceedancePolicy,
  dependencies: ExceedanceWorkerDependencies,
) {
  let stopped = false;
  let active: Promise<void> | null = null;
  const now = () => dependencies.now?.() ?? new Date();
  const run = async (settings: ActiveExceedancePolicy): Promise<void> => {
    const started = now();
    const deadline = started.getTime() + settings.budgetMs;
    let leaseOwned = true;
    const available = () => !stopped && leaseOwned && now().getTime() < deadline;
    const lease = await dependencies.acquire().catch(() => {
      dependencies.report({ mode: settings.mode, error: 'LEASE_UNAVAILABLE' });
      return null;
    });
    if (!lease) return;
    const renew = async () => {
      leaseOwned = await dependencies.renew(lease);
      return leaseOwned;
    };
    let cursor = lease.scanAfter;
    const stats = {
      mode: settings.mode,
      points: 0,
      hours: 0,
      candidates: 0,
      created: 0,
      duplicate: 0,
      unresolved: 0,
      backlogFull: 0,
      errors: 0,
      durationMs: 0,
    };
    try {
      // At most one batch per tick: reserve source capacity for normal API traffic.
      let batch = await dependencies.listPoints(cursor);
      if (batch.lastId === 0 && cursor !== 0) {
        cursor = 0;
        batch = await dependencies.listPoints(0);
      }
      stats.errors += batch.invalid;
      for (const point of batch.points) {
        if (!available()) break;
        if (!(await renew())) break;
        cursor = point.id;
        stats.points += 1;
        try {
          const state = await dependencies.state(lease, point, now());
          const latest =
            Math.floor((now().getTime() - settings.delayMinutes * 60_000) / HOUR_MS) * HOUR_MS -
            HOUR_MS;
          const hours: Date[] = [];
          if (state.backlogFull) stats.backlogFull += 1;
          if (!state.backlogFull && state.nextHour.getTime() <= latest) hours.push(state.nextHour);
          const retry = await dependencies.retryHour(point, now());
          if (
            retry &&
            retry.getTime() <= latest &&
            !hours.some((hour) => hour.getTime() === retry.getTime())
          )
            hours.push(retry);
          // A new hour always gets its turn before one bounded retry for this point.
          for (const hour of hours) {
            if (!available() || !(await renew())) break;
            let evaluation: ExceedanceEvaluation;
            if (
              hour < state.validFrom ||
              now().getTime() - hour.getTime() >= settings.lateHours * HOUR_MS
            ) {
              evaluation = { events: [], issues: ['CONFIG_HISTORY_UNAVAILABLE'] };
            } else if (
              !point.parameters.some(
                (parameter) =>
                  parameter.standardEnabled !== false || parameter.eiaEnabled !== false,
              )
            ) {
              evaluation = evaluateExceedanceHour(point, hour, []);
            } else {
              try {
                const rows = await dependencies.readRows(point, hour);
                evaluation = evaluateExceedanceHour(point, hour, rows);
              } catch {
                evaluation = { events: [], issues: ['SOURCE_ERROR'] };
              }
            }
            // Do not write a stale result after a timeout, shutdown, or lease takeover.
            if (!available() || !(await renew())) break;
            const result = await dependencies.commit(lease, point, hour, evaluation, now());
            stats.hours += 1;
            stats.candidates += evaluation.events.length;
            stats.created += result.created;
            stats.duplicate += result.duplicate;
            if (result.issues.length) stats.unresolved += 1;
          }
        } catch {
          // Log codes/counts only. Database messages can contain connection details.
          stats.errors += 1;
        }
      }
      if (available()) {
        cursor = batch.lastId;
        await dependencies.cleanup(now());
      }
    } catch {
      stats.errors += 1;
    } finally {
      try {
        await dependencies.release(lease, cursor);
      } catch {
        stats.errors += 1;
      }
      stats.durationMs = Math.max(0, now().getTime() - started.getTime());
      dependencies.report(stats);
    }
  };
  const runOnce = async (): Promise<void> => {
    if (stopped || active || policy.mode === 'off') return;
    active = run(policy);
    try {
      await active;
    } finally {
      active = null;
    }
  };
  const timer =
    policy.mode === 'off'
      ? null
      : setInterval(() => {
          void runOnce().catch(() => dependencies.report({ error: 'RUN_FAILED' }));
        }, 60_000);
  return {
    runOnce,
    async stop(): Promise<void> {
      stopped = true;
      if (timer) clearInterval(timer);
      await active;
    },
  };
}
