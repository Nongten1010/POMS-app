import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createAlertEmailWorker } from '../../src/modules/alert-emails/alert-email.worker';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
const policy = { enabled: true, hourlyDelayMinutes: 0 } as ActiveAlertEmailPolicy;
describe('alert email worker lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('has no timer, database, or dispatcher work when disabled', async () => {
    jest.useFakeTimers();
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
    expect(jest.getTimerCount()).toBe(0);
  });
  it('polls on wall-clock minute boundaries, including the exact hourly round', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T11:57:23.456+07:00'));
    const prepare = jest
      .fn<(now: Date, policy: ActiveAlertEmailPolicy) => Promise<void>>()
      .mockResolvedValue(undefined);
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValue({ claimed: false });
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
    expect(prepare).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(36_543);
    expect(prepare).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(prepare).toHaveBeenNthCalledWith(1, new Date('2026-10-05T11:58:00+07:00'), policy);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(prepare).toHaveBeenNthCalledWith(3, new Date('2026-10-05T12:00:00+07:00'), policy);
    await worker.stop();
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prepare).toHaveBeenCalledTimes(3);
  });
  it('schedules the next minute when created exactly on a minute boundary', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T12:00:00+07:00'));
    const prepare = jest
      .fn<(now: Date, policy: ActiveAlertEmailPolicy) => Promise<void>>()
      .mockResolvedValue(undefined);
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValue({ claimed: false });
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
    await worker.runOnce();
    expect(prepare).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(prepare).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(prepare).toHaveBeenNthCalledWith(2, new Date('2026-10-05T12:01:00+07:00'), policy);
    await worker.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['preparation', 'dispatch'] as const)(
    'replays an hourly round after a slow %s finishes without moving its cutoff',
    async (stage) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-05T11:58:50+07:00'));
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const prepare = jest
        .fn<(now: Date, policy: ActiveAlertEmailPolicy) => Promise<void>>()
        .mockImplementationOnce(async () => {
          if (stage === 'preparation') await blocked;
        })
        .mockResolvedValue(undefined);
      const dispatch = jest
        .fn<() => Promise<{ claimed: boolean }>>()
        .mockImplementationOnce(async () => {
          if (stage === 'dispatch') await blocked;
          return { claimed: false };
        })
        .mockResolvedValue({ claimed: false });
      const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
      await jest.advanceTimersByTimeAsync(10_000);
      await jest.advanceTimersByTimeAsync(80_000);
      expect(prepare).toHaveBeenCalledTimes(1);
      release();
      await jest.advanceTimersByTimeAsync(0);
      expect(prepare).toHaveBeenCalledTimes(2);
      expect(prepare).toHaveBeenNthCalledWith(2, new Date('2026-10-05T12:00:00+07:00'), policy);
      expect(new Date()).toEqual(new Date('2026-10-05T12:00:20+07:00'));
      expect(dispatch).toHaveBeenCalledTimes(2);
      await worker.stop();
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it.each([
    ['2026-10-05T11:59:50+07:00', '2026-10-05T12:00:50+07:00'],
    ['2026-10-05T11:58:50+07:00', '2026-10-05T12:00:50+07:00'],
  ])(
    'preserves the due hourly cutoff if a timer starting at %s fires late',
    async (start, late) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(start));
      const prepare = jest
        .fn<(now: Date, policy: ActiveAlertEmailPolicy) => Promise<void>>()
        .mockResolvedValue(undefined);
      const dispatch = jest
        .fn<() => Promise<{ claimed: boolean }>>()
        .mockResolvedValue({ claimed: false });
      const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
      jest.setSystemTime(new Date(late));
      await jest.advanceTimersByTimeAsync(10_000);
      expect(new Date()).toEqual(new Date('2026-10-05T12:01:00+07:00'));
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepare).toHaveBeenCalledWith(new Date('2026-10-05T12:00:00+07:00'), policy);
      await worker.stop();
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it('coalesces missed hourly rounds into the latest due round while busy', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T11:58:50+07:00'));
    let release!: () => void;
    const prepare = jest
      .fn<(now: Date, policy: ActiveAlertEmailPolicy) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValue({ claimed: false });
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
    await jest.advanceTimersByTimeAsync(10_000);
    await jest.advanceTimersByTimeAsync(3_680_000);
    expect(prepare).toHaveBeenCalledTimes(1);
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenNthCalledWith(2, new Date('2026-10-05T13:00:00+07:00'), policy);
    await worker.stop();
  });
  it('does not retain an overlapping manual runOnce call', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T12:10:00+07:00'));
    let release!: () => void;
    const prepare = jest
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const dispatch = jest
      .fn<() => Promise<{ claimed: boolean }>>()
      .mockResolvedValue({ claimed: false });
    const worker = createAlertEmailWorker(policy, { prepare, dispatch, reportError: jest.fn() });
    const activeRun = worker.runOnce();
    await worker.runOnce();
    release();
    await activeRun;
    expect(prepare).toHaveBeenCalledTimes(1);
    await worker.stop();
  });
  it('keeps a slow preparation from overlapping aligned timer ticks', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T11:57:23.456+07:00'));
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
    await jest.advanceTimersByTimeAsync(36_544);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(prepare).toHaveBeenCalledTimes(1);
    const stopping = worker.stop();
    resolve();
    await stopping;
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
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
