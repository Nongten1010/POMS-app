import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0107_enforce_admin_only_factory_approval';

describe('admin-only factory approval migration', () => {
  it('removes factories:approve role grants from every non-admin role', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = { raw } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = normalizeSql(raw.mock.calls.map(([statement]) => String(statement)).join('\n'));
    expect(sql).toContain('DELETE rp FROM role_permissions AS rp');
    expect(sql).toContain('INNER JOIN permissions AS p ON p.id = rp.permission_id');
    expect(sql).toContain('INNER JOIN roles AS r ON r.id = rp.role_id');
    expect(sql).toContain("p.code = 'factories:approve'");
    expect(sql).toContain("r.code <> 'admin'");
  });

  it('does not restore non-admin approval grants on rollback', async () => {
    const raw = jest.fn(async (_statement: string) => undefined);
    const knex = { raw } as unknown as Knex;

    await down(knex);

    expect(raw).not.toHaveBeenCalled();
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
