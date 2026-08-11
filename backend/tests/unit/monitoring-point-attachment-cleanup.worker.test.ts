import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

import { startMonitoringPointAttachmentCleanupWorker } from '../../src/modules/monitoring-point-forms/monitoring-point-attachment-cleanup.worker';

describe('monitoring point attachment cleanup worker', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs once at startup and then on the configured interval', async () => {
    jest.useFakeTimers();
    const cleanup = jest.fn(async () => 0);

    const interval = startMonitoringPointAttachmentCleanupWorker({
      cleanup,
      intervalMs: 15 * 60 * 1000,
    });
    await flushPromises();
    expect(cleanup).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(cleanup).toHaveBeenCalledTimes(2);
    clearInterval(interval);
  });

  it('continues scheduling cleanup after one failed run', async () => {
    jest.useFakeTimers();
    const cleanup = jest
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(0);

    const interval = startMonitoringPointAttachmentCleanupWorker({ cleanup, intervalMs: 1000 });
    await flushPromises();
    expect(cleanup).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(cleanup).toHaveBeenCalledTimes(2);
    clearInterval(interval);
  });

  it('does not overlap cleanup runs when one interval takes longer than expected', async () => {
    jest.useFakeTimers();
    let finishFirstRun: ((value: number) => void) | undefined;
    const cleanup = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          finishFirstRun = resolve;
        }),
    );

    const interval = startMonitoringPointAttachmentCleanupWorker({ cleanup, intervalMs: 1000 });
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1000);
    expect(cleanup).toHaveBeenCalledTimes(1);

    finishFirstRun?.(0);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1000);
    expect(cleanup).toHaveBeenCalledTimes(2);
    clearInterval(interval);
  });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
