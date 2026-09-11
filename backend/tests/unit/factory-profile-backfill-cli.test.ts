import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { runFactoryProfileBackfillCli } from '../../scripts/factory-profile-backfill';

const mockRun = jest.fn<() => Promise<unknown>>();
jest.mock('../../src/modules/factory-profiles/factory-profile-backfill', () => ({
  ...jest.requireActual<object>('../../src/modules/factory-profiles/factory-profile-backfill'),
  runFactoryProfileBackfill: (...args: unknown[]) => mockRun(...(args as [])),
}));

function io() {
  return { out: jest.fn<(value: string) => void>(), error: jest.fn<(value: string) => void>() };
}

describe('factory profile backfill CLI', () => {
  it('prints help without importing database configuration or connecting', async () => {
    const output = io();
    const load = jest.fn<() => Promise<Knex>>();
    expect(await runFactoryProfileBackfillCli(['--help'], output, load)).toBe(0);
    expect(load).not.toHaveBeenCalled();
    expect(output.out).toHaveBeenCalledWith(expect.stringContaining('dry-run'));
  });

  it('rejects invalid arguments before importing database configuration', async () => {
    const output = io();
    const load = jest.fn<() => Promise<Knex>>();
    expect(await runFactoryProfileBackfillCli(['--apply'], output, load)).toBe(1);
    expect(load).not.toHaveBeenCalled();
  });

  it('prints only the safe report and closes its connection pool', async () => {
    const output = io();
    const destroy = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const db = { destroy } as unknown as Knex;
    const report = { mode: 'dry-run', insertedProfiles: 0, counts: { conflicts: 0 } };
    mockRun.mockResolvedValueOnce(report);
    expect(await runFactoryProfileBackfillCli([], output, async () => db)).toBe(0);
    expect(output.out).toHaveBeenCalledWith(JSON.stringify(report, null, 2) + '\n');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('returns a distinct failure code for a dry-run report with unresolved conflicts', async () => {
    const output = io();
    const db = { destroy: async () => undefined } as unknown as Knex;
    mockRun.mockResolvedValueOnce({ counts: { conflicts: 1 } });
    expect(await runFactoryProfileBackfillCli([], output, async () => db)).toBe(2);
  });

  it('redacts driver errors and closes the connection after failure', async () => {
    const output = io();
    const destroy = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const db = { destroy } as unknown as Knex;
    mockRun.mockRejectedValueOnce(new Error('SQL secret password=fictional-secret'));
    expect(await runFactoryProfileBackfillCli([], output, async () => db)).toBe(1);
    expect(output.error.mock.calls.flat().join('')).not.toContain('fictional-secret');
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
