import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0104_create_eligible_factory_add_requests';
import {
  config as allowStatusOnlyApprovalConfig,
  down as rollbackAllowStatusOnlyApproval,
  up as allowStatusOnlyApproval,
} from '../../src/db/migrations/0105_allow_status_only_eligible_factory_add_request_approval';

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

describe('status-only eligible factory add request approval migration', () => {
  it('allows approved requests with either null or historical eligible factory ids', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = { schema: { raw } } as unknown as Knex;

    await allowStatusOnlyApproval(knex);

    expect(allowStatusOnlyApprovalConfig).toEqual({ transaction: true });
    const sql = normalizeSql(raw.mock.calls.map(([statement]) => String(statement)).join('\n'));
    expect(sql).toContain(
      'ALTER TABLE eligible_factory_add_requests DROP CONSTRAINT ck_eligible_factory_add_requests_review_state',
    );
    expect(sql).toContain(
      'ALTER TABLE eligible_factory_add_requests WITH CHECK ADD CONSTRAINT ck_eligible_factory_add_requests_review_state',
    );

    const approvedClause = sql.split("status = 'APPROVED'")[1]?.split("status = 'REJECTED'")[0];
    expect(approvedClause).toContain('is_open = 0');
    expect(approvedClause).toContain('reviewed_by IS NOT NULL');
    expect(approvedClause).toContain('reviewed_at IS NOT NULL');
    expect(approvedClause).not.toContain('eligible_factory_id');
    expect(sql).toContain(
      'CREATE INDEX ix_eligible_factory_add_requests_submitted ON eligible_factory_add_requests(submitted_at DESC, id DESC) WHERE deleted_at IS NULL',
    );
  });

  it('drops the unfiltered list index before restoring the original approval constraint', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = { schema: { raw } } as unknown as Knex;

    await rollbackAllowStatusOnlyApproval(knex);

    const sql = normalizeSql(raw.mock.calls.map(([statement]) => String(statement)).join('\n'));
    expect(allowStatusOnlyApprovalConfig).toEqual({ transaction: true });
    const dropIndexPosition = sql.indexOf(
      'DROP INDEX ix_eligible_factory_add_requests_submitted ON eligible_factory_add_requests',
    );
    const dropConstraintPosition = sql.indexOf(
      'DROP CONSTRAINT ck_eligible_factory_add_requests_review_state',
    );
    expect(dropIndexPosition).toBeGreaterThanOrEqual(0);
    expect(dropConstraintPosition).toBeGreaterThan(dropIndexPosition);

    const approvedClause = sql.split("status = 'APPROVED'")[1]?.split("status = 'REJECTED'")[0];
    expect(approvedClause).toContain('eligible_factory_id IS NOT NULL');
    expect(sql).toContain(
      'ALTER TABLE eligible_factory_add_requests WITH CHECK ADD CONSTRAINT ck_eligible_factory_add_requests_review_state',
    );
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\b/);
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

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
