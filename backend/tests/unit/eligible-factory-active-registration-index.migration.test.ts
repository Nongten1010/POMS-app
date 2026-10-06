import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  ACTIVE_REGISTRATION_INDEX,
  buildEligibleFactoryRegistrationIndexSql,
  config,
  down,
  up,
} from '../../src/db/migrations/0133_allow_duplicate_deleted_factory_registrations';

describe('eligible factory active registration uniqueness migration', () => {
  it('adds active uniqueness before replacing the old global uniqueness', () => {
    const sql = buildEligibleFactoryRegistrationIndexSql('up');
    expect(config.transaction).toBe(true);
    expect(sql.indexOf(`CREATE UNIQUE INDEX [${ACTIVE_REGISTRATION_INDEX}]`)).toBeLessThan(
      sql.indexOf('DROP INDEX [uq_eligible_factory_registration_new]'),
    );
    expect(sql).toContain(
      'WHERE [deleted_at] IS NULL AND [factory_registration_no_new] IS NOT NULL',
    );
    expect(sql).toContain('fk.key_index_id = @old_index_id');
    expect(sql).toContain('HAVING COUNT_BIG(*) > 1');
    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|ALTER\s+TABLE)\b/);
  });

  it('checks global duplicates before restoring the old index or removing active uniqueness', () => {
    const sql = buildEligibleFactoryRegistrationIndexSql('down');
    const duplicateGuard = sql.indexOf('THROW 51365');
    const restoreGlobal = sql.indexOf('CREATE UNIQUE INDEX [uq_eligible_factory_registration_new]');
    const removeActive = sql.indexOf(`DROP INDEX [${ACTIVE_REGISTRATION_INDEX}]`);
    expect(duplicateGuard).toBeGreaterThan(-1);
    expect(duplicateGuard).toBeLessThan(restoreGlobal);
    expect(restoreGlobal).toBeLessThan(removeActive);
  });

  it('uses only fixed temp tables and tempdb metadata for SQL Server fixture execution', () => {
    const sql = buildEligibleFactoryRegistrationIndexSql('up', 'fixture');
    expect(sql).toContain('[#registration_repair_eligible]');
    expect(sql).toContain('tempdb.sys.indexes');
    expect(sql).toContain("OBJECT_ID(N'tempdb..#registration_repair_eligible')");
    expect(sql).not.toContain('[dbo].[eligible_factories]');
    expect(sql).not.toContain('ON [dbo]');
  });

  it('passes schema batches to Knex without accessing or changing data through query builders', async () => {
    const raw = jest.fn<(sql: string) => Promise<void>>().mockResolvedValue();
    const knex = { raw } as unknown as Knex;
    await up(knex);
    await down(knex);
    expect(raw.mock.calls).toEqual([
      [buildEligibleFactoryRegistrationIndexSql('up')],
      [buildEligibleFactoryRegistrationIndexSql('down')],
    ]);
  });
});
