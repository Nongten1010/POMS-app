import 'dotenv/config';
import { readExceedancePolicy } from './modules/alert-exceedances/exceedance-policy';

/** Start explicitly alongside the API. Installing/deploying the code cannot activate it. */
async function main(): Promise<void> {
  const policy = readExceedancePolicy(process.env);
  if (policy.mode === 'off') {
    process.stdout.write('[alert-exceedance] OFF\n');
    return;
  }
  const { startExceedanceRuntime } = await import('./modules/alert-exceedances/exceedance-runtime');
  const worker = startExceedanceRuntime(policy);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), Math.max(30_000, policy.timeoutMs * 12));
    timeout.unref();
    try {
      await worker.stop();
    } catch {
      process.stderr.write('[alert-exceedance] SHUTDOWN_FAILED\n');
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
    process.exit(process.exitCode ? 1 : 0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
  process.once('disconnect', () => void stop());
  process.on('message', (message) => {
    if (message === 'stop') void stop();
  });
  await worker.runOnce();
}

void main().catch(() => {
  process.stderr.write('[alert-exceedance] START_FAILED (check detector policy and migration)\n');
  process.exitCode = 1;
});
