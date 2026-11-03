import { fork, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../../config/logger';
import { readExceedancePolicy, type ExceedancePolicy } from './exceedance-policy';

/** Run in a separate process, under the existing service account; never enable email. */
export function createExceedanceSupervisor(
  policy: ExceedancePolicy,
  spawn: () => ChildProcess,
  report: (code: string) => void,
) {
  let child: ChildProcess | null = null;
  let restart: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let failures = 0;
  const launch = () => {
    if (stopped || policy.mode === 'off') return;
    let started: ChildProcess;
    const retry = () => {
      if (stopped || restart) return;
      const delay = Math.min(60_000, 2_000 * 2 ** Math.min(failures++, 5));
      restart = setTimeout(() => {
        restart = null;
        launch();
      }, delay);
      restart.unref();
    };
    try {
      started = spawn();
      child = started;
    } catch {
      report('SPAWN_FAILED');
      retry();
      return;
    }
    const settled = () => {
      if (child !== started) return;
      child = null;
      if (!stopped) {
        report('WORKER_EXITED');
        retry();
      }
    };
    started.once('error', settled);
    started.once('exit', settled);
  };
  launch();
  return {
    async stop(): Promise<void> {
      stopped = true;
      if (restart) {
        clearTimeout(restart);
        restart = null;
      }
      const active = child;
      if (!active || active.exitCode !== null || active.signalCode !== null) return;
      await new Promise<void>((resolve) => {
        let complete = false;
        const done = () => {
          if (complete) return;
          complete = true;
          clearTimeout(timeout);
          active.removeListener('exit', done);
          resolve();
        };
        const timeout = setTimeout(() => {
          active.kill();
          done();
        }, 5_000);
        active.once('exit', done);
        if (active.connected) {
          try {
            active.send('stop', (error) => {
              if (error) {
                active.kill();
                done();
              }
            });
          } catch {
            active.kill();
            done();
          }
        } else {
          active.kill();
          done();
        }
      });
    },
  };
}

export function startExceedanceSupervisor(settings: NodeJS.ProcessEnv = process.env) {
  let policy: ExceedancePolicy;
  try {
    policy = readExceedancePolicy(settings);
  } catch {
    // Misconfiguration of an optional detector must not stop the existing HTTP/email service.
    logger.error('[alert-exceedance] POLICY_INVALID');
    return { stop: async () => undefined };
  }
  return createExceedanceSupervisor(
    policy,
    () => {
      const backendRoot = process.cwd();
      const directory = path.resolve(backendRoot, 'logs', 'alert-exceedance-worker');
      mkdirSync(directory, { recursive: true });
      const compiled = path.resolve(__dirname, '../../alert-exceedance-worker.js');
      const entry = existsSync(compiled)
        ? compiled
        : path.resolve(__dirname, '../../alert-exceedance-worker.ts');
      return fork(entry, [], {
        cwd: directory,
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        env: {
          ...settings,
          DOTENV_CONFIG_PATH: path.resolve(backendRoot, settings.DOTENV_CONFIG_PATH ?? '.env'),
        },
      });
    },
    (code) => logger.warn(`[alert-exceedance] ${code}`),
  );
}
