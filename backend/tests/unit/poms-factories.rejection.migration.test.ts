import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0130_allow_unrestricted_poms_edit_request_rejection';

describe('POMS unrestricted rejection migration', () => {
  it('allows REJECT audit entries from all six request statuses', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    await up({ schema: { raw } } as unknown as Knex);

    const sql = raw.mock.calls.map(([statement]) => statement).join('\n');
    const rejection = sql.match(/action = 'REJECT'\s+AND from_status IN \(([^)]+)\)/)?.[1];
    expect(rejection?.match(/'([^']+)'/g)).toEqual([
      "'PENDING_REVIEW'",
      "'REVISION_REQUESTED'",
      "'REVISED_PENDING_REVIEW'",
      "'APPROVED'",
      "'REJECTED'",
      "'CANCELLED'",
    ]);
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('WITH CHECK ADD CONSTRAINT');
    expect(sql).toContain(
      "action = 'CANCEL'\n        AND from_status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW', 'REJECTED')",
    );
  });

  it('checks rejection history before restoring the old transition constraint', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    await down({ schema: { raw } } as unknown as Knex);

    expect(raw.mock.calls[0]?.[0]).toContain("WHERE action = 'REJECT'");
    expect(raw.mock.calls[0]?.[0]).toContain(
      "AND from_status NOT IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')",
    );
    expect(raw.mock.calls[0]?.[0]).toContain('THROW 50001');
    expect(raw.mock.calls[0]?.[0]).not.toContain('ALTER TABLE');
    const restored = raw.mock.calls[1]?.[0];
    expect(restored).toContain(
      "action = 'REJECT'\n        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')",
    );
  });

  it('stops rollback without changing the constraint when the database reports incompatible history', async () => {
    const raw = jest.fn(async (_statement: string) => {
      throw new Error('Cannot roll back unrestricted rejection while its audit data exists');
    });
    await expect(down({ schema: { raw } } as unknown as Knex)).rejects.toThrow(
      'Cannot roll back unrestricted rejection while its audit data exists',
    );
    expect(raw.mock.calls).toHaveLength(1);
  });
});
