import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0125_reuse_deleted_local_user_identity';

async function captureSql(migrate: (knex: Knex) => Promise<void>): Promise<string> {
  const raw = jest.fn(async (_sql: string) => undefined);
  await migrate({ raw } as unknown as Knex);
  return raw.mock.calls.map(([sql]) => sql).join('\n');
}

describe('local user identity reuse migration', () => {
  it('keeps schema changes transactional and never rewrites users or historical relations', async () => {
    expect(config).toEqual({ transaction: true });

    for (const migrate of [up, down]) {
      const sql = await captureSql(migrate);
      expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/i);
      expect(sql).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/i);
      expect(sql).not.toMatch(/ALTER\s+COLUMN/i);
    }
  });

  it('allows only deleted local identities to be reused and keeps inactive accounts reserved', async () => {
    const sql = await captureSql(up);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX uq_users_provider\s+ON users\(identity_provider, external_id\)\s+WHERE identity_provider = 'local' AND deleted_at IS NULL;/,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX uq_users_external_provider\s+ON users\(identity_provider, external_id\)\s+WHERE identity_provider <> 'local';/,
    );
    expect(sql).not.toContain('is_active');
  });

  it('supports a legacy unique constraint or standalone unique index without dropping the primary key', async () => {
    const sql = await captureSql(up);
    expect(sql).toMatch(
      /FROM sys\.key_constraints\s+WHERE parent_object_id = OBJECT_ID\('users'\)\s+AND name = 'uq_users_provider' AND type = 'UQ'/,
    );
    expect(sql).toMatch(
      /ALTER TABLE users DROP CONSTRAINT uq_users_provider;\s+END\s+ELSE\s+BEGIN\s+DROP INDEX uq_users_provider ON users;/,
    );
    expect(sql).not.toMatch(/PRIMARY\s+KEY/i);
  });

  it('sets the SQL Server options required to create filtered indexes', async () => {
    const sql = await captureSql(up);
    expect(sql).toMatch(
      /SET ANSI_NULLS, ANSI_PADDING, ANSI_WARNINGS, ARITHABORT,\s+CONCAT_NULL_YIELDS_NULL, QUOTED_IDENTIFIER ON;/,
    );
    expect(sql).toContain('SET NUMERIC_ROUNDABORT OFF;');
    expect(sql.indexOf('SET NUMERIC_ROUNDABORT OFF')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX'),
    );
  });

  it('refuses rollback before changing indexes when historical and current identities overlap', async () => {
    const sql = await captureSql(down);
    expect(sql).toMatch(
      /IF EXISTS\s*\(\s*SELECT 1 FROM users WITH \(TABLOCKX, HOLDLOCK\)\s+GROUP BY identity_provider, external_id\s+HAVING COUNT_BIG\(\*\) > 1\s*\)\s*BEGIN\s+THROW 51125,/,
    );
    const guard = sql.slice(sql.indexOf('IF EXISTS'), sql.indexOf('THROW 51125'));
    expect(guard).not.toMatch(/\bWHERE\b/i);
    expect(sql.indexOf('THROW 51125')).toBeLessThan(sql.indexOf('DROP INDEX'));
    expect(sql).toMatch(
      /ALTER TABLE users ADD CONSTRAINT uq_users_provider\s+UNIQUE \(identity_provider, external_id\);/,
    );
  });
});
