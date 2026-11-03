import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  createExceedanceWorker,
  type ExceedanceWorkerDependencies,
} from '../../src/modules/alert-exceedances/exceedance-worker';
import type { ActiveExceedancePolicy } from '../../src/modules/alert-exceedances/exceedance-policy';
import type { ExceedanceSnapshot } from '../../src/modules/alert-exceedances/exceedance-metadata';

const hour = new Date('2026-11-03T10:00:00+07:00');
const current = new Date('2026-11-03T11:15:00+07:00');
const policy: ActiveExceedancePolicy = {
  mode: 'shadow',
  stations: ['S1'],
  cutover: hour,
  hourLabel: 'START',
  delayMinutes: 10,
  batchSize: 50,
  budgetMs: 300000,
  timeoutMs: 5000,
  lateHours: 24,
  recheckHours: 3,
};
const point = {
  id: 55,
  stationId: 'S1',
  systemType: 'CEMS',
  fingerprint: 'test',
  row: {},
  parameters: [{ label: 'CO (ppm)', standard: 120, eia: 100, activatedAt: '2026-11-01T00:00:00Z' }],
} as ExceedanceSnapshot;
function dependencies() {
  return {
    acquire: jest
      .fn<ExceedanceWorkerDependencies['acquire']>()
      .mockResolvedValue({ owner: 'owner', fence: 3, scanAfter: 0 }),
    renew: jest.fn<ExceedanceWorkerDependencies['renew']>().mockResolvedValue(true),
    release: jest.fn<ExceedanceWorkerDependencies['release']>().mockResolvedValue(undefined),
    listPoints: jest
      .fn<ExceedanceWorkerDependencies['listPoints']>()
      .mockResolvedValue({ points: [point], lastId: 55, invalid: 0 }),
    state: jest
      .fn<ExceedanceWorkerDependencies['state']>()
      .mockResolvedValue({ nextHour: hour, validFrom: hour }),
    retryHour: jest.fn<ExceedanceWorkerDependencies['retryHour']>().mockResolvedValue(null),
    readRows: jest
      .fn<ExceedanceWorkerDependencies['readRows']>()
      .mockResolvedValue([{ co_value: 125, co_status: 1, co_units: 'ppm' }]),
    commit: jest
      .fn<ExceedanceWorkerDependencies['commit']>()
      .mockResolvedValue({ created: 0, duplicate: 0, issues: [] }),
    cleanup: jest.fn<ExceedanceWorkerDependencies['cleanup']>().mockResolvedValue(undefined),
    report: jest.fn<ExceedanceWorkerDependencies['report']>(),
    now: () => current,
  };
}
const workers: ReturnType<typeof createExceedanceWorker>[] = [];
function worker(deps: ExceedanceWorkerDependencies, settings = policy) {
  const instance = createExceedanceWorker(settings, deps);
  workers.push(instance);
  return instance;
}
afterEach(async () => {
  for (const instance of workers.splice(0)) await instance.stop();
  jest.useRealTimers();
});

describe('bounded exceedance worker', () => {
  it('does not query raw measurements when both criteria are explicitly disabled', async () => {
    const deps = dependencies();
    const disabled = {
      ...point,
      parameters: point.parameters.map((parameter) => ({
        ...parameter,
        standardEnabled: false,
        eiaEnabled: false,
      })),
    };
    deps.listPoints.mockResolvedValue({ points: [disabled], lastId: 55, invalid: 0 });
    await worker(deps).runOnce();
    expect(deps.readRows).not.toHaveBeenCalled();
    expect(deps.commit).toHaveBeenCalledWith(
      expect.anything(),
      disabled,
      hour,
      expect.objectContaining({ events: [], issues: [] }),
      current,
    );
  });
  it('does no database or source work in off mode', async () => {
    const deps = dependencies();
    const instance = createExceedanceWorker({ mode: 'off' }, deps);
    await instance.runOnce();
    await instance.stop();
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.readRows).not.toHaveBeenCalled();
  });
  it('runs the real detector once per due hour, without an SMTP dependency', async () => {
    const deps = dependencies();
    await worker(deps).runOnce();
    expect(deps.readRows).toHaveBeenCalledTimes(1);
    expect(deps.commit).toHaveBeenCalledWith(
      expect.anything(),
      point,
      hour,
      expect.objectContaining({
        events: [
          expect.objectContaining({ thresholdType: 'STANDARD' }),
          expect.objectContaining({ thresholdType: 'EIA' }),
        ],
      }),
      current,
    );
    expect(deps.report).toHaveBeenCalledWith(expect.objectContaining({ candidates: 2, hours: 1 }));
  });
  it('does not reread completed hours before the persisted due time', async () => {
    const deps = dependencies();
    deps.state.mockResolvedValue({
      nextHour: new Date('2026-11-03T11:00:00+07:00'),
      validFrom: hour,
    });
    await worker(deps).runOnce();
    expect(deps.readRows).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });
  it('pauses new hours at the pending limit while still giving due retries a chance to resolve', async () => {
    const deps = dependencies();
    deps.state.mockResolvedValue({ nextHour: hour, validFrom: hour, backlogFull: true });
    deps.retryHour.mockResolvedValue(hour);
    await worker(deps).runOnce();
    expect(deps.readRows).toHaveBeenCalledTimes(1);
    expect(deps.report).toHaveBeenCalledWith(expect.objectContaining({ backlogFull: 1 }));
  });
  it('allows one new hour and one late retry per point, in that order', async () => {
    const deps = dependencies();
    const old = new Date(hour.getTime() - 3600000);
    deps.state.mockResolvedValue({ nextHour: hour, validFrom: old });
    deps.retryHour.mockResolvedValue(old);
    await worker(deps).runOnce();
    expect(deps.readRows.mock.calls.map((call) => call[1])).toEqual([hour, old]);
  });
  it('does not infer history or scan expired pending hours', async () => {
    const deps = dependencies();
    const old = new Date(hour.getTime() - 48 * 3600000);
    deps.state.mockResolvedValue({ nextHour: hour, validFrom: hour });
    deps.retryHour.mockResolvedValue(old);
    await worker(deps).runOnce();
    expect(deps.readRows).toHaveBeenCalledTimes(1);
    expect(deps.commit.mock.calls[1][3]).toEqual({
      events: [],
      issues: ['CONFIG_HISTORY_UNAVAILABLE'],
    });
  });
  it('persists source failure as unresolved and never as a normal reading', async () => {
    const deps = dependencies();
    deps.readRows.mockRejectedValue(new Error('secret connection diagnostic'));
    await worker(deps).runOnce();
    expect(deps.commit.mock.calls[0][3]).toEqual({ events: [], issues: ['SOURCE_ERROR'] });
    expect(JSON.stringify(deps.report.mock.calls)).not.toContain('secret');
  });
  it('rejects concurrent in-process ticks and stops after an in-flight source query', async () => {
    const deps = dependencies();
    let resolve!: (rows: Record<string, unknown>[]) => void;
    let signal!: () => void;
    const reading = new Promise<void>((done) => {
      signal = done;
    });
    deps.readRows.mockImplementation(() => {
      signal();
      return new Promise((done) => {
        resolve = done;
      });
    });
    const instance = worker(deps);
    const running = instance.runOnce();
    await reading;
    await instance.runOnce();
    const stopping = instance.stop();
    resolve([{ co_value: 125, co_status: 1, co_units: 'ppm' }]);
    await running;
    await stopping;
    expect(deps.acquire).toHaveBeenCalledTimes(1);
    expect(deps.commit).not.toHaveBeenCalled();
  });
  it('does not persist source results or cleanup after losing the database lease', async () => {
    const deps = dependencies();
    deps.renew.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    await worker(deps).runOnce();
    expect(deps.readRows).toHaveBeenCalledTimes(1);
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.cleanup).not.toHaveBeenCalled();
  });
  it('releases the lease and records safe diagnostics when metadata loading fails', async () => {
    const deps = dependencies();
    deps.listPoints.mockRejectedValue(new Error('secret credential diagnostic'));
    await worker(deps).runOnce();
    expect(deps.release).toHaveBeenCalled();
    expect(deps.report).toHaveBeenCalledWith(expect.objectContaining({ errors: 1 }));
    expect(JSON.stringify(deps.report.mock.calls)).not.toContain('secret');
  });
  it('does not write after exceeding the round budget', async () => {
    const deps = dependencies();
    let time = current;
    deps.now = () => time;
    deps.readRows.mockImplementation(async () => {
      time = new Date(current.getTime() + policy.budgetMs);
      return [];
    });
    await worker(deps).runOnce();
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalled();
  });
});
