import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0078_backfill_connection_request_snapshot_locations';

describe('connection request snapshot location backfill', () => {
  it('fills only missing locations from the linked eligible factory', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = String(raw.mock.calls[0]?.[0]);
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('request_row.eligible_factory_id');
    expect(sql).toContain('eligible_row.province_name');
    expect(sql).toContain('COALESCE(snapshot_row.province_name, eligible_row.province_name)');
    expect(sql).toContain('snapshot_row.deleted_at IS NULL');
    expect(sql).toContain('snapshot_row.province_name IS NULL');
  });

  it('does not attempt to undo repaired location data', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    expect(raw).not.toHaveBeenCalled();
  });
});
