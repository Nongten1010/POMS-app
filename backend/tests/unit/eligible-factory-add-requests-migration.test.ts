import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0104_create_eligible_factory_add_requests';

describe('eligible factory add requests migration', () => {
  it('creates the auditable request table with a concurrency-safe open-request invariant', async () => {
    const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) =>
      callback(chainable()),
    );
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = {
      schema: { createTable, raw, dropTableIfExists: jest.fn() },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable).toHaveBeenCalledWith('eligible_factory_add_requests', expect.any(Function));

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('ck_eligible_factory_add_requests_status');
    expect(sql).toContain("'PENDING_REVIEW'");
    expect(sql).toContain("'APPROVED'");
    expect(sql).toContain("'REJECTED'");
    expect(sql).toContain('ck_eligible_factory_add_requests_snapshot_json');
    expect(sql).toContain('ISJSON(factory_snapshot_json) = 1');
    expect(sql).toContain('ck_eligible_factory_add_requests_review_state');
    expect(sql).toContain('AND officer_note IS NOT NULL');
    expect(sql).toContain('ck_eligible_factory_add_requests_no_self_review');
    expect(sql).toContain('uq_eligible_factory_add_requests_open_factory');
    expect(sql).toContain('ON eligible_factory_add_requests(factory_master_id)');
    expect(sql).toContain('WHERE deleted_at IS NULL AND is_open = 1');
  });

  it('drops the request table on rollback', async () => {
    const dropTableIfExists = jest.fn(async (_tableName: string) => undefined);
    const knex = {
      schema: { dropTableIfExists },
    } as unknown as Knex;

    await down(knex);

    expect(dropTableIfExists).toHaveBeenCalledWith('eligible_factory_add_requests');
  });
});

function chainable(): unknown {
  let chain: unknown;
  const callable = () => chain;
  chain = new Proxy(callable, {
    get: () => chain,
    apply: () => chain,
  });
  return chain;
}
