import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0088_soft_delete_forms_for_removed_eligible_factories';

describe('removed eligible-factory form cleanup migration', () => {
  it('soft-deletes only orphaned active forms and their points', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('DROP TABLE IF EXISTS #removed_eligible_forms_0088');
    expect(sql).toContain('UPDATE point_row');
    expect(sql).toContain('UPDATE form_row');
    expect(sql).toContain('deleted_eligible.deleted_at IS NOT NULL');
    expect(sql).toContain('active_eligible.deleted_at IS NULL');
    expect(sql).toContain('connected_point.deleted_at IS NULL');
    expect(sql.match(/NOT EXISTS/gu)?.length).toBeGreaterThanOrEqual(2);
  });

  it('does not resurrect cleaned-up operational data during rollback', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    expect(raw).not.toHaveBeenCalled();
  });
});
