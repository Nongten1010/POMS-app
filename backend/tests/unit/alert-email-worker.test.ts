import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createAlertEmailWorker } from '../../src/modules/alert-emails/alert-email.worker';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
const policy = { enabled: true } as ActiveAlertEmailPolicy;
describe('alert email worker lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('has no timer, database, or dispatcher work when disabled', async () => {
    const prepare = jest.fn<() => Promise<unknown>>();
    const dispatch = jest.fn<() => Promise<{ claimed: boolean }>>();
    const worker = createAlertEmailWorker(
      { enabled: false },
      { prepare, dispatch, reportError: jest.fn() },
    );
    await worker.runOnce();
    await worker.stop();
    expect(prepare).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('does not overlap ticks and stops before any pending send after shutdown', async () => {
    jest.useFakeTimers();
    let resolve!: () => void;
    const prepare = jest.fn<() => Promise<void>>().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValue({ claimed: false });
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
    const activeRun = worker.runOnce();
    await worker.runOnce();
    expect(prepare).toHaveBeenCalledTimes(1);
    const stopping = worker.stop();
    resolve();
    await activeRun;
    await stopping;
    expect(dispatch).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
  it('continues dispatching queued mail even if preparation is temporarily unavailable', async () => {
    const prepare = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('secret DB diagnostic'));
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValueOnce({ claimed: true })
      .mockResolvedValue({ claimed: false });
    const reportError = jest.fn();
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError });
    await worker.runOnce();
    await worker.stop();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith('PREPARATION_FAILED');
    expect(JSON.stringify(reportError.mock.calls)).not.toContain('secret');
  });
});
