import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  up,
} from '../../src/db/migrations/0110_clear_production_poms_factory_edit_requests';

describe('production master-data cleanup', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function database(after = [0, 0, 42]) {
    const counts = [3, 7, 42, ...after];
    const db = Object.assign(
      jest.fn(() => ({ count: () => ({ first: async () => ({ count: counts.shift() }) }) })),
      { raw: jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([]) },
    );
    return db;
  }

  it('does not execute against non-production', async () => {
    process.env.NODE_ENV = 'test';
    const db = database();
    await up(db as unknown as Knex);
    expect(db).not.toHaveBeenCalled();
    expect(db.raw).not.toHaveBeenCalled();
  });

  it('backs up before deleting only master-data requests within a transaction', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_NAME = 'POMS';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = database();
    await up(db as unknown as Knex);
    expect(config.transaction).toBe(true);
    const sql = db.raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql.indexOf('INTO dbo.poms_factory_edit_requests_backup')).toBeLessThan(
      sql.indexOf('DELETE FROM'),
    );
    expect(sql.match(/DELETE FROM dbo\.\w+/g)).toEqual([
      'DELETE FROM dbo.poms_factory_edit_request_events',
      'DELETE FROM dbo.poms_factory_edit_requests',
    ]);
    expect(sql).toContain('TABLOCKX, HOLDLOCK');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('preserved 42'));
  });

  it.each([
    [[0, 0, 41], 'Connection-request guard failed'],
    [[1, 0, 42], 'did not empty'],
  ])('rejects inconsistent post-delete counts %j', async (counts, message) => {
    process.env.NODE_ENV = 'production';
    process.env.DB_NAME = 'POMS';
    await expect(up(database(counts as number[]) as unknown as Knex)).rejects.toThrow(
      message as string,
    );
  });
});
