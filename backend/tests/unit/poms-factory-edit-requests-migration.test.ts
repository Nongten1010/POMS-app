import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0100_create_poms_factory_edit_requests';

describe('POMS factory edit requests migration', () => {
  it('creates auditable request and event tables with the complete state machine', async () => {
    const createTable = jest.fn(async (_tableName: string, callback: (table: unknown) => void) =>
      callback(chainable()),
    );
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = {
      schema: { createTable, raw, dropTableIfExists: jest.fn() },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(createTable.mock.calls.map(([tableName]) => tableName)).toEqual([
      'poms_factory_edit_requests',
      'poms_factory_edit_request_events',
    ]);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('ck_poms_factory_edit_requests_status');
    expect(sql).toContain("'PENDING_REVIEW'");
    expect(sql).toContain("'REVISION_REQUESTED'");
    expect(sql).toContain("'REVISED_PENDING_REVIEW'");
    expect(sql).toContain("'APPROVED'");
    expect(sql).toContain("'REJECTED'");
    expect(sql).toContain('ck_poms_factory_edit_requests_current_factory_json');
    expect(sql).toContain('ISJSON(current_factory_json) = 1');
    expect(sql).toContain('ck_poms_factory_edit_requests_proposed_factory_json');
    expect(sql).toContain('ISJSON(proposed_factory_json) = 1');
    expect(sql).toContain('CHECK (revision_no >= 0)');
    expect(sql).toContain('uq_poms_factory_edit_requests_open_factory');
    expect(sql).toContain('WHERE deleted_at IS NULL AND is_open = 1');
    expect(sql).toContain('ck_poms_factory_edit_request_events_transition');
    expect(sql).toContain("action = 'RESUBMIT'");
    expect(sql).toContain("action = 'REQUEST_REVISION'");
    expect(sql).toContain("action = 'APPROVE'");
    expect(sql).toContain("action = 'REJECT'");
  });

  it('drops events before requests so the foreign key remains reversible', async () => {
    const dropTableIfExists = jest.fn(async (_tableName: string) => undefined);
    const knex = {
      schema: { dropTableIfExists },
    } as unknown as Knex;

    await down(knex);

    expect(dropTableIfExists.mock.calls.map(([tableName]) => tableName)).toEqual([
      'poms_factory_edit_request_events',
      'poms_factory_edit_requests',
    ]);
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
