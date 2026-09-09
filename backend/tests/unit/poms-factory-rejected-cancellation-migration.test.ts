import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { up as originalUp } from '../../src/db/migrations/0109_add_poms_factory_edit_request_cancellation';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0111_allow_rejected_poms_factory_edit_request_cancellation';

function harness() {
  const raw = jest.fn(async (_sql: string) => undefined);
  return { raw, knex: { schema: { raw } } as unknown as Knex };
}
function transition(sql: string): string {
  return sql
    .replace(/\s+/gu, ' ')
    .match(
      /WITH CHECK ADD CONSTRAINT ck_poms_factory_edit_request_events_transition (CHECK \(.*?\));/u,
    )![1];
}

describe('rejected POMS factory request cancellation migration', () => {
  it('adds REJECTED cancellation while preserving every other event transition', async () => {
    const original = harness();
    const updated = harness();
    await originalUp(original.knex);
    await up(updated.knex);
    const oldRule = transition(original.raw.mock.calls[0][0]);
    const newSql = updated.raw.mock.calls[0][0];
    expect(config).toEqual({ transaction: true });
    expect(transition(newSql)).toBe(
      oldRule.replace(
        "action = 'CANCEL' AND from_status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW')",
        "action = 'CANCEL' AND from_status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW', 'REJECTED')",
      ),
    );
    expect(newSql).toContain('CHECK CONSTRAINT ck_poms_factory_edit_request_events_transition');
    expect(newSql).not.toMatch(/\b(?:UPDATE|DELETE|INSERT)\b/u);
  });

  it('refuses rollback before dropping the constraint if audit data uses the new transition', async () => {
    const h = harness();
    h.raw.mockRejectedValueOnce(new Error('existing audit data'));
    await expect(down(h.knex)).rejects.toThrow('existing audit data');
    expect(h.raw).toHaveBeenCalledTimes(1);
    expect(h.raw.mock.calls[0][0]).toContain("action = 'CANCEL' AND from_status = 'REJECTED'");
    expect(h.raw.mock.calls[0][0]).toContain('THROW 50001');
    expect(h.raw.mock.calls[0][0]).not.toContain('DROP CONSTRAINT');
  });

  it('restores the exact original rule on a permitted rollback', async () => {
    const original = harness();
    const h = harness();
    await originalUp(original.knex);
    await down(h.knex);
    expect(transition(h.raw.mock.calls[1][0])).toBe(transition(original.raw.mock.calls[0][0]));
  });
});
