import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0109_add_poms_factory_edit_request_cancellation';

describe('POMS factory edit request cancellation migration', () => {
  it('extends request state and event transitions for cancellation', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join(' '),
    );
    expect(sql).toContain(
      "CHECK (status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'))",
    );
    expect(sql).toContain("status IN ('APPROVED', 'REJECTED', 'CANCELLED') AND is_open = 0");
    expect(sql).toContain(
      "CHECK (action IN ('SUBMIT', 'RESUBMIT', 'APPROVE', 'REQUEST_REVISION', 'REJECT', 'CANCEL'))",
    );
    expect(sql).toContain(
      "action = 'CANCEL' AND from_status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW') AND to_status = 'CANCELLED'",
    );
    for (const constraint of [
      'ck_poms_factory_edit_requests_status',
      'ck_poms_factory_edit_requests_state',
      'ck_poms_factory_edit_request_events_action',
      'ck_poms_factory_edit_request_events_from_status',
      'ck_poms_factory_edit_request_events_to_status',
      'ck_poms_factory_edit_request_events_transition',
    ]) {
      expect(sql).toContain(`DROP CONSTRAINT ${constraint}`);
      expect(sql).toContain(`WITH CHECK ADD CONSTRAINT ${constraint}`);
      expect(sql).toContain(`CHECK CONSTRAINT ${constraint}`);
    }
  });

  it('guards rollback before dropping constraints when cancellation data exists', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join(' '),
    );
    const requestGuard = sql.indexOf("FROM poms_factory_edit_requests WHERE status = 'CANCELLED'");
    const eventGuard = sql.indexOf(
      "FROM poms_factory_edit_request_events WHERE action = 'CANCEL' OR from_status = 'CANCELLED' OR to_status = 'CANCELLED'",
    );
    const throwPosition = sql.indexOf('THROW 50001');
    const dropPosition = sql.indexOf(
      'DROP CONSTRAINT ck_poms_factory_edit_request_events_transition',
    );

    expect(requestGuard).toBeGreaterThanOrEqual(0);
    expect(eventGuard).toBeGreaterThanOrEqual(0);
    expect(throwPosition).toBeGreaterThan(eventGuard);
    expect(dropPosition).toBeGreaterThan(throwPosition);
    expect(sql).toContain(
      'Cannot roll back POMS factory edit request cancellation while its data exists',
    );
  });

  it('restores the original request and event constraints without mutating data', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join(' '),
    );
    const restored = sql.slice(
      sql.indexOf('DROP CONSTRAINT ck_poms_factory_edit_request_events_transition'),
    );
    expect(restored).toContain(
      "CHECK (status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW', 'APPROVED', 'REJECTED'))",
    );
    expect(restored).toContain(
      "CHECK (action IN ('SUBMIT', 'RESUBMIT', 'APPROVE', 'REQUEST_REVISION', 'REJECT'))",
    );
    expect(restored).not.toContain("action = 'CANCEL'");
    expect(restored).not.toContain("to_status = 'CANCELLED'");
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\b/u);
  });
});

function migrationHarness(): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
} {
  const raw = jest.fn(async (_statement: string) => undefined);
  const knex = { schema: { raw } } as unknown as Knex;
  return { knex, raw };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/gu, ' ').trim();
}
