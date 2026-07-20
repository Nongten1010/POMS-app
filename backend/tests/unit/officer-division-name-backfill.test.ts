import { describe, expect, it, jest } from '@jest/globals';
import { down, up } from '../../src/db/migrations/0072_backfill_officer_division_name_th';

describe('0072_backfill_officer_division_name_th', () => {
  it('backfills only blank division display names from matching division organizations', async () => {
    const raw = jest.fn<(sql: string) => Promise<void>>(async () => undefined);
    const knex = { raw } as never;

    await up(knex);

    expect(raw).toHaveBeenCalledTimes(1);
    const sql = String(raw.mock.calls[0]?.[0]).replace(/\s+/g, ' ').trim();
    expect(sql).toContain('UPDATE op');
    expect(sql).toContain('org.external_id = op.division_id');
    expect(sql).toContain("org.level = 'division'");
    expect(sql).toContain('op.division_name_th IS NULL');
    expect(sql).toContain("LTRIM(RTRIM(op.division_name_th)) = ''");
  });

  it('uses a no-op down migration because the data repair is not reversible', async () => {
    const raw = jest.fn<(sql: string) => Promise<void>>(async () => undefined);

    await expect(down({ raw } as never)).resolves.toBeUndefined();
    expect(raw).not.toHaveBeenCalled();
  });
});
