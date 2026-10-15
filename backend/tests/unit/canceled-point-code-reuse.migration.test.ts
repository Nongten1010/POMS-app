import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0138_allow_canceled_point_code_reuse';
import { up as retiredOnly } from '../../src/db/migrations/0126_allow_unconnected_point_code_release';

function harness() {
  const raw = jest.fn(async (_statement: string) => undefined);
  return { raw, knex: { schema: { raw } } as unknown as Knex };
}

describe('canceled point-code reuse database guard', () => {
  it('permits canceled or retired sources while keeping connected history and live config guards', async () => {
    const h = harness();
    await up(h.knex);
    const statement = h.raw.mock.calls[0][0];
    expect(config.transaction).toBe(true);
    for (const guard of [
      'INSTEAD OF UPDATE, DELETE',
      'THROW 51095',
      'THROW 51096',
      "source_request.status <> 'CANCELED'",
      'source.deleted_at IS NULL',
      'connected.source_measurement_point_id = source.id',
      'UPPER(LTRIM(RTRIM(connected.point_code))) = reservation.normalized_point_code',
      "other_request.status <> 'CANCELED'",
      'live_config.request_id IS NULL',
      'WITH (UPDLOCK, HOLDLOCK)',
    ])
      expect(statement).toContain(guard);
    expect(statement).not.toMatch(
      /DELETE\s+(?:FROM\s+)?cems_wpms_(?:measurement_points|connection_requests|request_status_history)/i,
    );
  });

  it('restores the previous guarded release trigger on rollback', async () => {
    const current = harness();
    const previous = harness();
    await down(current.knex);
    await retiredOnly(previous.knex);
    expect(current.raw.mock.calls).toEqual(previous.raw.mock.calls);
  });
});
