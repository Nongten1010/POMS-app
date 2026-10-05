import type { Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import { up, down } from '../../src/db/migrations/0129_allow_rejected_connection_request_status';

describe('connection request rejection database contract', () => {
  it('allows REJECTED while retaining every existing request status', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);
    await up({ schema: { raw } } as unknown as Knex);
    const constraint = raw.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('CHECK (status IN'));
    for (const status of [
      'PENDING_DESIGN_REVIEW',
      'WAITING_CONNECTION',
      'WAITING_FACTORY_REVISION',
      'REVISED_PENDING_DESIGN_REVIEW',
      'CONNECTION_CONFIRMED',
      'CONNECTED',
      'CANCELED',
      'REJECTED',
    ]) {
      expect(constraint).toContain(`'${status}'`);
    }
  });

  it('refuses rollback before altering the constraint if rejected requests still exist', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async (sql) => {
      if (sql.includes("WHERE status = 'REJECTED'")) throw new Error('Rejected requests exist');
    });
    await expect(down({ schema: { raw } } as unknown as Knex)).rejects.toThrow(
      'Rejected requests exist',
    );
    expect(raw).toHaveBeenCalledTimes(1);
  });
});
